---
layout: doc
title: "Windows signed update-feed contract"
---

# Windows signed update-feed contract

The Windows Electron controller accepts only a direct HTTPS Squirrel.Windows
feed directory. Before Electron's `autoUpdater` checks for packages, the main
process requests that directory's `RELEASES` manifest and validates its shape.
This gives the operator a useful failure at the **Check for updates** control
when a website URL, an incomplete directory, or a stale proxy was configured.

## Behaviour

- Empty feed configuration leaves updates disabled.
- HTTP, credentials in the URL, query strings, fragments, and GitHub Pages
  hosts are rejected before a request is made.
- The normalized directory URL is checked for a direct `RELEASES` response.
  The manifest is bounded to 256 KiB, must contain at least one package, and
  each entry must have a 40-character SHA-1, a safe `.nupkg` filename, and a
  positive package size.
- A valid manifest is only a preflight. Squirrel.Windows still performs the
  package-signature verification and download. The controller never downloads
  an installer itself and never invents an `update-ready` state.
- A failed preflight clears stale readiness and becomes the ordinary,
  dismissible error notification. The non-blocking **Restart to install update**
  action is emitted only by Electron's real `update-downloaded` event.

## Configuration and security

Enter the HTTPS feed directory in Settings. Do not put credentials in the URL;
the feed should be public or protected by the platform's normal transport/auth
boundary, not by embedding a secret in this app's profile. The URL is stored
with the other controller preferences but never logged. `RELEASES` and the
packages must be signed in the release pipeline; manifest syntax alone is not a
signature or an installer trust decision.

## Failure modes and recovery

| Symptom | Meaning | Recovery |
| --- | --- | --- |
| `GitHub Pages is an HTML site` | A Pages URL was entered, not a feed directory. | Use the signed Squirrel feed directory. |
| `HTTP 404` or `HTTP 503` | `RELEASES` is missing or the feed is unavailable. | Restore the feed and use **Check for updates** again. |
| `invalid SHA-1`, package name, or size | The manifest is not a Squirrel `RELEASES` file. | Regenerate the release feed; do not bypass validation. |
| Electron reports a signature error | The package was not signed by the trusted release path. | Keep the current version and repair signing; no install is offered. |

## Verification

From `desktop-electron/`:

```powershell
npm test
npm run build
npm run dist
```

`tests/update-contract.mjs` covers URL normalization, rejected unsafe forms,
manifest bounds and fields, direct-feed preflight, and HTTP failure recovery.
`npm run dist` produces the non-empty Setup.exe, `.nupkg`, and `RELEASES` files;
local artifacts are not evidence of Authenticode or Squirrel trust because the
checkout has no private signing certificate. The release workflow remains the
place to attach artifacts and to provide the signed-feed evidence.

## Suggested articles

- Windows Electron controller — the
  controller's API boundary and local profile.
- Line counts and release archives — CI artifact and release
  provenance.
- Deployment — the hosted service the controller calls.
