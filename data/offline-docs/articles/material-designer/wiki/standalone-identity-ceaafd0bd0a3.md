# Standalone identity

Installed beside the upstream product, an unrebranded build of this project is
**the same application** as far as Windows is concerned. That is not a branding
observation — it is eight concrete collisions, five of which corrupt or break
something.

This page exists because "we renamed it" sounds cosmetic, and the work was not.

## The five that break things

**1 · A shared user-data directory.** Electron derives `userData` from
`productName`, so both products resolved to the same `%APPDATA%` path — one SQLite
database, one artifacts tree, one credential store, two applications writing them.
That is guaranteed mutual corruption, not a race that usually works out.

**2 · A shared single-instance lock.** Chromium keys that lock on the `userData`
directory. With both products pointing at one directory, launching this app while
the other was running made it silently `app.quit()` — no error, no window, nothing
in the interface to diagnose.

**3 · A shared Windows named pipe.** The daemon's IPC endpoint is a single global
name. Whichever product bound it first owned it; the second talked to the wrong
engine or failed to start.

**4 · A shared uninstall registry key.** Both installers wrote the same
Add/Remove Programs entry, so uninstalling *either* product deleted the other's
entry — and the registry-residue cleanup would happily remove a key belonging to a
different application.

**5 · Auto-update into a different product.** The packaged build shipped with the
updater **enabled by default** and pointed at upstream's release feed. Left alone,
a build of this project would have polled that feed, downloaded upstream's
installer, and replaced itself with the other product.

> [!IMPORTANT]
> An application must never update itself into something else. The default origin
> is now inert, and a packaged build enables the updater only when it was actually
> given a feed of its own.

## The three quieter ones

**6 · One-click routes into the other product.** Three buttons opened upstream's
downloads page — the About panel's release-notes link, the update dialog's
manual-download button, and the post-update highlights card's fallback.

**7 · Remotely-controlled content from an upstream-owned host.** The daemon
fetched a highlights document from that host on every launch and rendered its
title, body, image and clickable link inside this application. That is another
project's operators holding editorial control of a surface in this product, plus a
launch signal from every user, configured by nobody. It is now opt-in with no
default.

**8 · A hardcoded menu label** naming the other product, living outside the
translation files so no locale edit would ever reach it.

## Why a find-and-replace would not have worked

There were **three separate product-name constants** and a **fourth copy of the
identity logic** in the end-to-end test helper. Fixing the roots also surfaced two
build-breaking literals that a rename by hand would have left behind: the payload
writer looked for an executable under the old product name while the builder
produced the new one, and the launcher archive path disagreed with the paths module
about its own filename.

## What was deliberately left alone

The `od://` URL scheme, the `open-design:` storage key prefix, the
`@open-design/*` workspace package names, the `OD_*` environment variables,
`open-design-config.json`, the `resources/open-design` folder and the `od` CLI
name.

None of them collides between installs, and renaming them would be a large
refactor that buys no coexistence. Internal identifiers are not branding.

## Trademarks

Apache-2.0 grants no trademark rights. The upstream project's name, logo and
application identity belong to that project. Builds published here carry their own
identity and are not produced by, endorsed by, or affiliated with it.
