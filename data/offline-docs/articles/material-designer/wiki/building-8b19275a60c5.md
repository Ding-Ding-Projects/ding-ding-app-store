# Building

**Continuous integration is the supported path.** Installing this project compiles
native modules from source, builds nineteen workspace targets, and packs an
Electron application — a heavyweight operation with real toolchain prerequisites.
The workflows do it on a hosted Windows runner, and their logs are the evidence.

You can still build locally. This page covers both.

## What CI does

| Workflow | Runs on | Does |
|---|---|---|
| `verify.yml` | every push | Proves `design/` matches upstream, then runs the full unit suite on Linux |
| `release.yml` | push to `main` | Installs, typechecks, tests, builds the installer, **installs and launches it**, publishes a release |
| `pages.yml` | changes under `site/` | Publishes the documentation site |

The release job's smoke test is the part worth knowing about. It installs the
built `.exe`, checks the install directory, uninstaller, shortcuts and registry
entries, **starts the application**, asks the running process to fetch its own
health endpoint from inside its renderer, screenshots the live window, then
uninstalls and asserts zero residue. That is the difference between "it compiled"
and "it works".

## Building locally

Requires **Node 24** and **pnpm 10.33.2**. On Windows use npm rather than
corepack, which fails with EPERM:

```sh
npm install -g pnpm@10.33.2
```

Then:

```sh
git clone --recurse-submodules https://github.com/Ding-Ding-Projects/material-designer
cd material-designer

# Prove the imported tree still matches upstream before building it.
sh scripts/verify-port.sh

cd design
pnpm install --frozen-lockfile
pnpm --filter @open-design/daemon run build
pnpm --filter @open-design/desktop run build
pnpm exec tools-pack win build --to nsis
```

`pnpm install` also runs the root postinstall, which builds the workspace
packages and tools. Budget real time for it on a cold machine.

### Prerequisites that bite

The daemon depends on a native SQLite binding with **no prebuilt binary** for this
Node version on Windows, so it is compiled from source. That needs Visual Studio
Build Tools 2022 or newer with the desktop C++ workload, plus Python 3 on the
path. A terminal PTY module compiles the same way.

## Tests are split by platform, deliberately

The Windows job runs the specs only Windows can answer — installer identity,
install paths, build targets, launcher payload. **Everything else runs on Linux.**

That split is not a convenience. Several specs assert things a Windows filesystem
cannot represent: a macOS binary keeping its Unix executable bit, or a module
layout built with symlinks a runner has no privilege to create. Running them on
Windows fails for reasons that have nothing to do with the code under test.

Between the two jobs **every spec runs somewhere**, and neither job is quietly
skipping the awkward ones. Both workflow files say which and why, so the filter is
not mistaken later for tests being swept aside.

## If a build fails

The release job uploads its logs on failure and the installer artifact even when
later steps fail, so a red run leaves something to inspect rather than just a red
tick.
