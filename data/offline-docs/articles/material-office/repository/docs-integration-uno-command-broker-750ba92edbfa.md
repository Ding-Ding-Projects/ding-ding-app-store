# Catalog-locked UNO command broker

> This broker ships in the `0.1.0` Windows release. Catalog membership does not guarantee a command is available in the current LibreOffice context.

## Behavior

The renderer sends a stable catalog ID. The main process reloads the bundled feature tuple, decodes entity-bearing query strings, reproduces the ID, maps scope to a document context, starts LibreOffice on a random named pipe, and asks its bundled Python/UNO runtime to dispatch the exact command.

## Configuration

No arbitrary command configuration exists. Catalog updates happen through the tracked `features.json` and tests. Scope selects Writer, Calc, Impress/Draw, Base, Math, or a common context.

## Failure modes

Unknown ID, changed tuple, unavailable bundled Python/pyuno, listener timeout, context rejection, malformed output, and command dispatch failure remain distinct. A command can be valid but unavailable in the current LibreOffice state.

## Security

The broker uses a cryptographically random named pipe, unique profile, bounded process/output/time, exact argument arrays, and no TCP listener. It does not accept raw URI, macro, path, or script input and never logs document content.

## Verification

Tests cover ID/tuple/scope/path/output boundaries with fake runners. Local development smoke has exercised installed UNO connectivity; no published installer or remote workflow has yet supplied release evidence.

## Suggested articles

[Command Explorer](app-doc://article/material-office.repository.a27034625581927c) · [LibreOffice integration](app-doc://article/material-office.repository.945def60ac462e7d) · [Calc](app-doc://article/material-office.repository.8d56887694d35e98)
