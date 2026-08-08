# Desktop manager (C# WPF)

> A Windows desktop GUI that configures and runs the world-downloader web console as a Docker container, and drives the optional BlueMap 3D-map and mineflayer auto-explore bot helpers.

## What it does

The desktop manager (`WorldDownloaderManager`) is a single-window Windows app that wraps the world-downloader so a user never has to type a `docker run` command. From one screen it lets you:

- Pick a **data folder** on the PC (mapped into the container as `/data`) where downloaded worlds, the block/registry cache, the Minecraft account session and console settings live.
- Configure the **web console port** (default `8080`), the **Minecraft proxy port** (default `25565`), the **Docker image**, and an optional **console login** (username/password).
- **Start** / **Stop** the container, **Open console** (browser to `http://localhost:<web port>`), open the **Live map** (`/map`), **Update image** (docker pull), and **Generate compose** (write a `docker-compose.yml` into the data folder).
- Render an interactive **3D map with BlueMap** (optionally upgrading the world with a server jar first) and open it.
- Run one or more **mineflayer auto-explore bots** that connect through the proxy and walk/fly a grid so an area downloads automatically.
- Show **live output** from every command it runs, plus a status banner.
- Switch **theme** (Dark / Light / High contrast) and toggle **Large text** for accessibility.
- Navigate browser-style **Downloader / Settings / Regex builder / Notifications** tabs.
- Choose English, playful Hong Kong-style Cantonese, or bilingual copy with independent persisted funny levels from 1–5.
- Search Settings in plain text or with its anchored, bounded **.NET regex builder**; the full builder tab adds guided constructs, flags, sample text, live matches/captures, copy and export.
- Review non-blocking notifications, select an external editor, and opt out of the bundled 1% startup dim-sum delight.

Settings persist between launches, and unhandled errors are caught and logged rather than silently killing the window.

## How it works

**Stack & shell.** The app is WPF (`WorldDownloaderManager.csproj`: `UseWPF=true`, `OutputType=WinExe`, `TargetFramework=net8.0-windows`, `RuntimeIdentifiers=win-x64;win-arm64`). `MainWindow.xaml` now uses a persistent M3-styled tab strip with scrollable card pages; code-behind is supplemented by focused copy and regex services.

**Startup & crash handling.** `App.OnStartup` (`App.xaml.cs`) wires three global handlers — `DispatcherUnhandledException` (marked `Handled = true` so the app survives UI errors), `AppDomain.CurrentDomain.UnhandledException`, and `TaskScheduler.UnobservedTaskException`. Each calls `Report`, which appends the exception to `%LOCALAPPDATA%\WorldDownloaderManager\crash.log` and shows a `MessageBox`.

**Settings.** `Settings` (`Settings.cs`) is serialized to `%APPDATA%\WorldDownloaderManager\settings.json`. `Load()` falls back to defaults, migrates the legacy image name, clamps preference ranges, and migrates the legacy plaintext password into Windows DPAPI ciphertext scoped to the current user. The clear password is never serialized. Language, independent funny levels, dim-sum opt-out, theme, text/font preferences and external-editor path persist.

**Docker integration.** `DockerService` (`DockerService.cs`) is a thin wrapper over the `docker` CLI. `RunAsync` launches `docker` with `UseShellExecute=false`, streams stdout/stderr (UTF-8) line-by-line to the `OnOutput` callback (the app routes this to the log box), and returns `(exitCode, capturedOutput)`. Key operations:
- `IsDockerAvailableAsync` → `docker version --format {{.Server.Version}}` (success = exit 0).
- `IsRunningAsync(container)` → `docker ps --filter name=^/<container>$ --filter status=running --format {{.Names}}`.
- `RemoveAsync` → `docker rm -f <container>`.
- `PullAsync` → `docker pull <image>`.
- `BuildAsync(context, tag)` → `docker build -t <tag> <context>` — used by the **Build locally** option to build the image from a source checkout instead of pulling.
- `RunContainerAsync(settings)` → `docker run -d --name <name> --restart unless-stopped -p <web>:8080 -p <proxy>:25565 -v <dataFolder>:/data [-e WEB_USERNAME=… -e WEB_PASSWORD=…] <EffectiveImage>`. The login env vars are only added when `RequireLogin` is true **and** the password is non-empty. `Settings.EffectiveImage` is the locally-built tag (`minecraft-world-downloader-web:local`) when **Build locally** is on, else the configured GHCR image.

**Main flow.** `MainWindow` constructs a `Settings` (via `Load`) and a `DockerService`, binds the UI fields, and on `Loaded` runs `InitAsync`: if Docker is unavailable it sets an error status and stops; otherwise `RefreshStatusAsync` checks whether the container is running and enables/disables Start vs Stop accordingly. `SaveFromUi` reads the UI back into `Settings` (ports validated by `ParsePort`, which accepts integers in `1..65535` and otherwise uses a fallback) and saves.
- **Start** (`Start_Click`): saves, requires a data folder, creates it, `docker rm -f` any stale container, then either **builds locally** (`BuildAsync`, when **Build locally** is on — resolving the source folder via `FindBuildContext`, which uses the configured path or auto-detects a `Dockerfile` near the app) or **pulls** the latest image (`PullAsync`), then `RunContainerAsync`; on exit code 0 it opens the console in the default browser.
- **Build locally** (`BuildLocalCheck` toggle + `BuildContextBox`): when on, the image is built from a local source checkout (`Settings.BuildLocally`/`BuildContext`) and tagged `minecraft-world-downloader-web:local` instead of being pulled — useful offline, behind a firewall, or to run your own changes. The **Update image** (pull) button is disabled in this mode.
- **Stop** (`Stop_Click`): `docker rm -f` the container.
- **Update image** (`Pull_Click`): `docker pull` (disabled while **Build locally** is on).
- **Generate compose** (`GenerateCompose_Click`): writes `Settings.WriteDockerCompose()` output into the data folder and opens the folder in Explorer. The compose maps `<WebPort>:8080` and `<ProxyPort>:25565`, sets `WEB_PORT: "8080"`, conditionally writes `WEB_USERNAME`/`WEB_PASSWORD`, and mounts `<dataPath>:/data` (backslashes converted to forward slashes). With **Build locally** on it emits `build: "<source>"` + a local `image:` tag (run with `docker compose up -d --build`) instead of `image:` + `pull_policy: always`.
- **Open console / Live map**: `Process.Start` to `http://localhost:<webPort>` and `…/map`.
- A `Busying(bool)` helper toggles the indeterminate progress bar and disables Start/Stop/Pull/Browse while work is in flight.

**Theme & accessibility.** Brushes in `MainWindow.xaml` are mutable and recolored live for Dark / Light / High contrast. Theme, large text, font family and font scale persist. Tabs use native tab semantics and visible keyboard focus. Toasts are named live regions, dismissible, and mirrored into Notifications history. The startup dim-sum surface cannot take focus and uses dish-specific alt text.

**Regex safety.** `RegexBuilderService` evaluates the real .NET dialect locally with flags `i`, `m`, `s`, and `n`, a 2,048-character pattern limit, 100,000-character sample limit, 150 ms timeout and 500-result cap. Syntax/timeout errors are inline; zero-width matches and capture groups are handled safely.

**BlueMap 3D map.** `RenderMap_Click` requires a data folder, then locates `bluemap/pipeline.py` via `FindPipeline` (checks next to the executable, one level up, then `<data>/bluemap`). It derives `world=<data>/world`, `workdir=<data>/bluemap`, `webroot=<workdir>/web`, builds a `settings.json` from the UI (`acceptDownload:true`, `renderThreadCount`, `webserverEnabled:true`, `webserverPort`, and the chosen `dimensions` of overworld/nether/end), and invokes the pipeline as `<py> pipeline.py all --world … --out … --workdir … --settings …` plus `--server-jar <jar>` if one is set. `RunPythonAsync` tries `python`, then `python3`, then `py` in order, streaming output. `OpenMap_Click` opens `http://localhost:<bmPort>`.

**Auto-explore bot.** `BotStart_Click` saves, refuses to double-start, requires a data folder, and locates `scraper/scrape.js` via `FindScraper` (same three-location search as BlueMap). It builds a JSON config (`ui-config.json` written next to `scrape.js`) containing `host:127.0.0.1`, `port:<proxyPort>`, an `accounts` array (one per bot; auth `offline`/`microsoft`, usernames suffixed `1,2,…` when count > 1), `centerOnSpawn`, `radius`, `preferFly`, `revisit`, optional `loginPassword` (AuthMe), and a `visitedFile` at `<data>/bot-visited.json`. On first run, if `node_modules` is missing it runs `npm install --no-audit --no-fund` (trying `npm.cmd` then `npm`). It then starts `node scrape.js --config ui-config.json` (trying `node` then `node.exe`), tracks the process in `_botProc`, wires `Exited` to re-enable Start, and `BotStop_Click` kills the process tree.

**Packaging / install.** CI (`.github/workflows/desktop-release.yml`) runs `dotnet publish … -c Release -r win-x64 --self-contained true -o …\publish` on `windows-latest`, installs NSIS via Chocolatey, and runs `makensis` passing `APP_VERSION`, `SRC_DIR=…\publish`, and `OUT_FILE`. On a `v*`/`desktop-v*` tag the `.exe` installer is attached to a GitHub release. `installer/installer.nsi` (NSIS + MUI2) installs to `$PROGRAMFILES64`, requires admin, copies the published tree, creates Start-menu and Desktop shortcuts, writes Add/Remove Programs (`Uninstall`) registry entries, and provides an uninstaller that removes the install dir, shortcuts, and registry keys.

## Key files

- `desktop/MainWindow.xaml` — single-window UI layout: status banner, data-folder picker, configuration card, action buttons, BlueMap card, bot card, output log, theme/large-text controls, and all styles/brushes.
- `desktop/MainWindow.xaml.cs` — all UI logic: settings binding, Docker start/stop/pull/compose, browser launches, theme switching, BlueMap rendering (Python), and the mineflayer bot launcher (npm/node).
- `desktop/Settings.cs` — persisted settings model (`%APPDATA%\WorldDownloaderManager\settings.json`), defaults, and `ToDockerCompose`/`WriteDockerCompose`.
- `desktop/DockerService.cs` — `docker` CLI wrapper: availability/running checks, `rm -f`, `pull`, and `run` with port/volume/login mapping.
- `desktop/App.xaml.cs` — global exception handlers and crash logging to `%LOCALAPPDATA%\WorldDownloaderManager\crash.log`.
- `desktop/AppCopy.cs` — factual localized event copy with independent English/Cantonese funny levels.
- `desktop/RegexBuilderService.cs` — bounded .NET regex construction/evaluation and capture models.
- `desktop/Assets/DimSum/` — three bundled offline startup-delight images.
- `desktop.tests/DesktopFeatureTests.cs` — security, YAML, localization and regex regression tests.
- `desktop/WorldDownloaderManager.csproj` — WPF / `net8.0-windows` project; `win-x64`/`win-arm64` RIDs.
- `installer/installer.nsi` — NSIS installer (shortcuts, Add/Remove Programs entry, uninstaller).
- `.github/workflows/desktop-release.yml` — publishes self-contained `win-x64` build and packages it with NSIS, attaching to a release on tag.
- `bluemap/pipeline.py` — external helper the app shells out to for world upgrade + BlueMap render/serve (not part of the C# project).
- `scraper/scrape.js` — external mineflayer auto-explorer the app shells out to (not part of the C# project).

## Configuration / flags

The app has **no command-line flags**. User-facing configuration lives in the UI and persists to `settings.json`:

- **Data folder** — host path mounted as `/data`.
- **Web console port** (`WebPort`, default `8080`) — published as `<WebPort>:8080`.
- **Minecraft proxy port** (`ProxyPort`, default `25565`) — published as `<ProxyPort>:25565`.
- **Docker image** (`Image`, default `ghcr.io/cafepromenade/minecraft-world-downloader-web:latest`).
- **Require a login** (`RequireLogin`, default off) with **Console username** (`Username`, default `admin`) and **Console password** (`Password`). When enabled (and password non-empty) these are passed to the container as `WEB_USERNAME` / `WEB_PASSWORD` env vars (the generated compose always sets `WEB_PORT: "8080"`).
- `ContainerName` (default `minecraft-world-downloader`) — persisted but not surfaced as an editable field in the UI.

BlueMap card settings (written to `<data>/bluemap/settings.json`, not persisted in `settings.json`): server jar path (optional), render threads (`0`=auto), web map port (default `8100`), and dimension checkboxes (overworld/nether/end).

Bot card settings (written to `scraper/ui-config.json`, not persisted in `settings.json`): account type (Offline/Microsoft), username (default `Scraper`), radius (default `256`), bot count (default `1`), AuthMe login password, and the toggles Center on spawn / Fly (creative) / Revisit downloaded.

Build-time NSIS defines (`installer.nsi`): `APP_VERSION`, `SRC_DIR`, `OUT_FILE` — supplied by CI. The hardcoded default `SRC_DIR` in the script points at a `net8.0-windows10.0.19041.0\...\publish` path that does not match the actual `net8.0-windows` build output; CI overrides it with an explicit `SRC_DIR`, so the stale default is never used in the release build.

## Usage

1. Install Docker Desktop and make sure it is running. (Node.js and Python+Java are only needed for the bot and BlueMap features respectively.)
2. Install the manager from the NSIS setup `.exe` (or run a local `dotnet publish`/`dotnet run` of `desktop/WorldDownloaderManager.csproj`) and launch it.
3. Choose a data folder with plenty of free space.
4. Adjust ports / image / login if needed, then click **Start**. The app starts the container and opens the console in the browser. In Minecraft, connect to `localhost:<proxy port>` instead of the real server to download.
5. Use **Open console** / **Live map** to reopen the web UI, **Update image** to pull the newest build, **Generate compose** to write a `docker-compose.yml` (run it with `docker compose up -d`), and **Stop** to remove the container (worlds in the data folder are kept).
6. Optionally render a **3D map** (set a server jar if you want the world upgraded first, choose dimensions/threads/port, click **Render 3D map**, then **Open 3D map**), and/or start the **auto-explore bot** (pick account, radius, count, click **Start bot**).

## Verification

- `dotnet build desktop/WorldDownloaderManager.csproj -c Release` passes with zero warnings and zero errors.
- `dotnet test desktop.tests/WorldDownloaderManager.Tests.csproj -c Release` passes 10/10 tests covering DPAPI/no-plaintext serialization, secret redaction, hostile YAML values, valid/invalid/Unicode/zero-width/adversarial regexes, capture groups, bounded output, and independent bilingual humour.
- Lowlevel MCP launched the real WPF build on an off-screen desktop and captured Downloader, Settings, Regex builder, and forced dim-sum states under `docs/images/desktop-global-memory/`.
- Docker, BlueMap and bot process integrations remain outside this unit-test boundary and require their external runtimes.

| Downloader | Settings | Regex builder | Startup delight |
|---|---|---|---|
| *Image omitted from the offline bundle: Downloader tab.* | *Image omitted from the offline bundle: Settings tab.* | *Image omitted from the offline bundle: Regex builder tab.* | *Image omitted from the offline bundle: Shrimp dumpling startup toast.* |

## Gotchas & limitations

- **Windows-only.** WPF + `net8.0-windows`; the bot/python launchers also probe Windows-style executables (`npm.cmd`, `node.exe`, `py`).
- **Explicit compose export contains the configured password** when login protection is enabled; protect that user-requested deployment file accordingly. Normal settings use current-user DPAPI encryption, and Docker command logs redact password/token/secret/key environment values.
- **Compose scalars are defensively encoded.** Quotes, backslashes, newlines, tabs and control characters cannot escape their YAML value.
- **Docker must be present and running**; if `docker version` fails the app shows an error and does not retry automatically (you must reopen the app).
- **`ContainerName` is fixed via settings only** — there is no UI to run multiple containers with different names at once.
- **External helpers are not bundled by the C# project.** `bluemap/pipeline.py` and `scraper/scrape.js` must be discoverable next to the executable, one directory up, or under the data folder; if missing, the feature reports an error. Whether the installer ships them depends on what is present in the published output tree (`File /r "${SRC_DIR}\*.*"`), which is not guaranteed by the csproj itself.
- **BlueMap needs Python + Java; the bot needs Node.js** on PATH. Missing toolchains surface as log/status errors only.
- **"WinUI 3" naming is inaccurate** — comments in `installer.nsi` and the release workflow call it WinUI 3, but it is a WPF app.
- **Generate-compose sets `WEB_PORT: "8080"`** (container-internal) and relies on the host port mapping for the actual exposed port; this is internal-vs-host port wiring that may confuse users editing the file by hand.

## Open items

- Full per-element appearance editing, theme import/export, tab reordering/pinning/overflow, local Git-backed version history, and the complete in-app historical changelog remain planned global-memory work.
