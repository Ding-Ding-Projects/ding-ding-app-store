# Deployment, CI & installer

> How the project is built, containerized, released, and installed: a multi-stage Docker image (downloader jar + Python web console + mineflayer bot), GitHub Actions for PR builds / JAR releases / GHCR image pushes / desktop installer releases, and an NSIS installer for the Windows desktop manager.

## What it does

This feature covers everything that turns the source tree into runnable, distributable artifacts:

- A **Docker image** (`Dockerfile`) that builds the `world-downloader.jar`, then assembles a runtime image containing the JRE, a Python web management console, and a Node/mineflayer auto-explore bot. The container's entrypoint is the web console.
- A **`docker-compose.yml`** that runs the web-console container and an optional BlueMap 3D-map renderer container.
- A **Windows NSIS installer** (`installer/installer.nsi`) that packages the self-contained .NET desktop manager (`WorldDownloaderManager`) into a `Setup.exe` with Start-menu/desktop shortcuts and an uninstaller.
- **Five GitHub Actions workflows**:
  - `build.yml` — PR build + test.
  - `maven-publish.yml` — tag-driven JAR release.
  - `docker-image.yml` — build and push the container image to GHCR.
  - `desktop-release.yml` — build the desktop manager + NSIS installer, attach to release on a tag.
  - `release.yml` — "all-in-one" release that builds jar + desktop app, bundles them into the installer, and publishes a GitHub release on every push to `main`.

## How it works

### Docker image (`Dockerfile`)

Two-stage build:

1. **Builder stage** (`maven:3.9-eclipse-temurin-21`): copies only `pom.xml` first and runs `mvn -q -B dependency:go-offline` so the dependency download is cached in its own layer (re-downloaded only when the pom changes). Then copies `src/` and runs `mvn -q -B clean package -DskipTests`, producing `target/world-downloader.jar`. A commented-out BuildKit cache-mount alternative is documented inline.
2. **Runtime stage** (`eclipse-temurin:21-jre`): installs `python3`, `python3-pip`, `curl`, `ca-certificates`, `gnupg`, and Node.js 20 (via the NodeSource setup script). It copies the jar to `/app/world-downloader.jar`, copies `web/` and `pip install`s `web/requirements.txt` (with `--break-system-packages`), and copies `scraper/` and runs `npm install --omit=dev` so the console can launch the mineflayer bot.

Runtime config is via env vars `JAR_PATH=/app/world-downloader.jar`, `DATA_DIR=/data`, `WEB_PORT=8080`. It declares a `/data` volume, `EXPOSE 8080 25565` (8080 = web console, 25565 = the Minecraft proxy clients connect to), a `HEALTHCHECK` that polls `http://127.0.0.1:8080/healthz`, and `ENTRYPOINT ["python3", "/app/web/app.py"]` — i.e. the container runs the web console, which in turn manages the downloader jar.

### Compose (`docker-compose.yml`)

- `world-downloader` service: `build: .`, image `minecraft-world-downloader`, `restart: unless-stopped`, maps host `8080:8080` (console) and `25565:25565` (proxy), mounts `./data:/data`. `WEB_PORT=8080` is set; optional `WEB_USERNAME`/`WEB_PASSWORD`/`SECRET_KEY` lines are present but commented out (the console has no login by default).
- `bluemap` service (under the `bluemap` profile, off by default): built from `bluemap/Dockerfile` (also a `temurin:21-jre` + `python3` image that runs `bluemap/pipeline.py` via `bluemap/docker-entrypoint.sh`), renders `WORLD_DIR=/data/world`, serves the 3D map on `8100`. Enabled with `docker compose --profile bluemap up -d bluemap`.

### NSIS installer (`installer/installer.nsi`)

A Modern UI 2 (`MUI2.nsh`) installer for the WinUI/.NET desktop manager. Defines (overridable via `/D` defines at build time):

- `APP_VERSION` (default `1.0.0`),
- `SRC_DIR` (default `..\desktop\bin\Release\net8.0-windows10.0.19041.0\win-x64\publish`),
- `OUT_FILE` (default `WorldDownloaderManager-Setup.exe`).

Installs to `$PROGRAMFILES64\World Downloader Manager`, requires admin (`RequestExecutionLevel admin`), recursively copies the publish output (`File /r "${SRC_DIR}\*.*"`), writes `InstallDir` under `HKLM\Software\WorldDownloaderManager`, creates Start-menu and Desktop shortcuts to `WorldDownloaderManager.exe`, writes a Windows "Uninstall" registry entry (DisplayName/Version/Publisher/Icon/UninstallString, `NoModify=1`, `NoRepair=1`), and writes `Uninstall.exe`. The finish page offers to launch the app. The Uninstall section removes shortcuts, `RMDir /r "$INSTDIR"`, and deletes the registry keys.

### CI/CD workflows (`.github/workflows/`)

- **`build.yml`** (on `pull_request`): `build` job on `ubuntu-latest` sets up JDK 21 (Temurin, maven cache) and runs `mvn clean -q` → `mvn compile -q` → `mvn package -DskipTests -q`, with heavily decorated step-timing/summary log output. A dependent `test` job runs `mvn -B test -DskipTests=false` with `continue-on-error: true` (tests are skipped by default in the pom, opted back in here). Note: the `Build Summary Report` step always prints "BUILD SUCCESSFUL" regardless of real status.
- **`maven-publish.yml`** (on tag `v*` or manual dispatch): JDK 21, extracts version from the `v`-prefixed tag, `mvn -B clean package` (tests run here — no `-DskipTests`), and uses `softprops/action-gh-release@v2` to create a release with auto-generated notes and upload `target/world-downloader.jar`.
- **`docker-image.yml`** (on push to **`main`** or **`master`**, tags `v*`, or path changes under `src/`, `web/`, `scraper/`, `pom.xml`, `Dockerfile`, the workflow itself; also manual dispatch): on `ubuntu-latest`, sets up Buildx, lower-cases the repo name and appends `-web` to form `ghcr.io/<owner>/<repo>-web`, logs in to GHCR with `GITHUB_TOKEN`, derives tags via `docker/metadata-action` (`latest` on default branch, `type=ref` on tag, short SHA), and `docker/build-push-action@v6` builds context `.` and pushes with GitHub Actions layer cache (`type=gha`). The `-web` suffix makes the package a fresh, repo-owned package so `GITHUB_TOKEN` inherits write access (the legacy `...-downloader` package's ACL denied automated pushes).
- **`desktop-release.yml`** (on tags `v*` / `desktop-v*` or manual dispatch): on `windows-latest`, sets up .NET 8, resolves version from the tag, `dotnet publish desktop/WorldDownloaderManager.csproj -c Release -r win-x64 --self-contained true` to `publish/`, installs NSIS via Chocolatey, runs `makensis.exe` with `/DAPP_VERSION`, `/DSRC_DIR=...\publish`, `/DOUT_FILE=...Setup.exe`, uploads the installer artifact, and (on a tag) attaches it to a GitHub release.
- **`release.yml`** ("All-in-one release", on push to **`main`** ignoring `**/*.md` and `docs/**`, or manual dispatch): on `windows-latest`, builds the jar (JDK 21, `mvn ... package -DskipTests`), publishes the desktop app (.NET 8, self-contained win-x64), resolves a version of the form `1.0.<run_number>`, **bundles** `world-downloader.jar` + `docker-compose.yml` + a `git archive` `source.zip` into `publish\resources\`, builds the installer with NSIS, also stages the bare jar + `source.zip` as standalone assets, uploads everything as an artifact, and publishes a GitHub release tagged `build-<run_number>` with the installer, jar, and source zip attached.

### Version branching / notable splits

- Two "release" pipelines coexist: `release.yml` fires on every push to `main`; `docker-image.yml` fires on push to `main` or `master`. The fork's GitHub default branch is `main`, so `latest` (tagged with `enable={{is_default_branch}}`) is published when building from `main` — keeping the GHCR image current with the code the all-in-one release also builds.
- JAR releases come from two paths: tag-driven `maven-publish.yml` (tests run) and per-push `release.yml` (tests skipped, version `1.0.<run_number>`).

## Key files

- `Dockerfile` — two-stage build (Maven builder → Temurin JRE runtime) producing the web-console container; entrypoint is `web/app.py`.
- `docker-compose.yml` — `world-downloader` service plus optional `bluemap` profile service.
- `bluemap/Dockerfile` — companion image that renders/serves the downloaded world as a BlueMap 3D map on port 8100.
- `installer/installer.nsi` — NSIS (MUI2) installer for the self-contained Windows desktop manager.
- `desktop/WorldDownloaderManager.csproj` — .NET 8 WinExe (`net8.0-windows`, `UseWPF`, RIDs `win-x64;win-arm64`) packaged by the installer.
- `.github/workflows/build.yml` — PR build + (best-effort) test.
- `.github/workflows/maven-publish.yml` — tag-driven JAR GitHub release.
- `.github/workflows/docker-image.yml` — build + push container image to GHCR.
- `.github/workflows/desktop-release.yml` — build desktop app + NSIS installer, attach to tag release.
- `.github/workflows/release.yml` — all-in-one release on push to `main` (jar + desktop + bundled installer + source zip).
- `pom.xml` — Maven build; `finalName` `world-downloader`, main class `Launcher`, shade plugin, `<skipTests>true</skipTests>` by default.

## Configuration / flags

Docker / compose env vars:
- `JAR_PATH` (default `/app/world-downloader.jar`), `DATA_DIR` (default `/data`), `WEB_PORT` (default `8080`) — set in the Dockerfile.
- `WEB_USERNAME`, `WEB_PASSWORD`, `SECRET_KEY` — optional console auth, commented out in `docker-compose.yml` (no login by default).
- BlueMap: `WORLD_DIR` (default `/data/world`), `BLUEMAP_PORT` (default `8100`), `WORKDIR` (default `/data/bluemap`).

NSIS build-time defines (passed via `makensis /D...`):
- `APP_VERSION` (default `1.0.0`), `SRC_DIR` (default points at the desktop publish folder), `OUT_FILE` (default `WorldDownloaderManager-Setup.exe`). Internal constants: `APP_NAME` "World Downloader Manager", `APP_EXE` `WorldDownloaderManager.exe`, `PUBLISHER` `cafepromenade`.

Workflow inputs/derived versions:
- `maven-publish.yml` / `desktop-release.yml`: version derived from the `v` / `desktop-v` git tag.
- `release.yml`: version `1.0.<github.run_number>`; release tag `build-<run_number>`.
- `docker-image.yml`: image tags `latest` (default branch), tag ref, and short SHA.

No application CLI flags are introduced by this feature; it only builds/packages the existing jar and desktop app.

## Usage

- **Run via Docker Compose:** `docker compose up -d` → web console at `http://localhost:8080`, point a Minecraft client at `localhost:25565`; downloaded data persists in `./data`. Add the 3D map with `docker compose --profile bluemap up -d bluemap` (map at `http://localhost:8100`).
- **Pull the prebuilt image:** `docker run ... ghcr.io/<owner>/<repo>-web:latest` (image is published by `docker-image.yml`).
- **Run the jar directly:** download `world-downloader.jar` from a release and run `java -jar world-downloader.jar`.
- **Install the desktop manager (Windows):** download `WorldDownloaderManager-Setup.exe` from a release and run it; installs to Program Files with Start-menu/desktop shortcuts and an uninstaller. The all-in-one installer also drops the jar, `docker-compose.yml`, and full `source.zip` under the install dir's `resources/` folder.
- **Cut releases:** push to `main` for an automatic all-in-one release **and** a refreshed GHCR `latest` image; push a `v*` tag for the JAR release (`maven-publish.yml`) and the desktop installer release (`desktop-release.yml`).

## Verification

- **PR build (`build.yml`)** compiles and packages the jar on every pull request; the separate `test` job runs unit tests but is `continue-on-error: true`, so test failures do not fail the workflow.
- The build/release workflows assert the jar exists (`ls -lh target/world-downloader.jar`) and `release.yml` / `desktop-release.yml` `throw` on a non-zero `makensis` exit code.
- This documentation review is **read/static only** — I did not run `docker build`, `makensis`, or the workflows. Correctness of the build is exercised by the CI workflows themselves rather than verified here. Per project memory, the wider build is JDK-21-based with 2 known environment-only test failures.

## Gotchas & limitations

- **GHCR `latest` follows the default branch:** `docker-image.yml` now triggers on `main` (and `master`), and `latest` is tagged via `enable={{is_default_branch}}`. Since the fork's default branch is `main`, pushing there refreshes both the all-in-one release and the GHCR image. (Previously the workflow only triggered on `master`, so the image went stale relative to `main` — fixed.) The desktop manager also `docker pull`s before each launch, so it never runs a stale cached image.
- **`build.yml` always reports success:** the summary step hard-codes "BUILD SUCCESSFUL" and the `test` job swallows failures (`continue-on-error`), so a green check does not guarantee passing tests.
- **NSIS default `SRC_DIR` path is fragile:** it points at `net8.0-windows10.0.19041.0\win-x64\publish`, but the csproj's `TargetFramework` is `net8.0-windows` (no platform-version suffix). CI always overrides `SRC_DIR` to the `dotnet publish` output, so the default path is only a fallback and may not match a local publish.
- **Desktop installer is x64-only / Windows-only:** the csproj lists `win-x64;win-arm64`, but both workflows publish and package only `-r win-x64`; the installer forces `$PROGRAMFILES64` and `RequestExecutionLevel admin`.
- **Web console is unauthenticated by default:** auth env vars are commented out in compose; exposing port 8080 beyond localhost without setting them leaves the console open.
- **No tests in the image build / all-in-one release:** the Dockerfile and `release.yml` use `-DskipTests`, so packaging there never runs the test suite (only `maven-publish.yml` runs tests as part of release).
- **`--break-system-packages` pip install** in the Dockerfile bypasses PEP 668 protections in the Debian-based runtime image.
- **Node.js installed via piped NodeSource script** (`curl ... | bash -`) — relies on the external NodeSource endpoint at build time.

## Open items

None known.
