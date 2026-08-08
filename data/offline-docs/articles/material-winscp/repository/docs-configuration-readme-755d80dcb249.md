# Configuration

This category documents the durable configuration store and its migration
boundaries. The project exposes no HTTP API, so API artifacts are not
applicable.

## Articles

| Article | Covers |
| --- | --- |
| [migration.md](app-doc://article/material-winscp.repository.af304a80728c3d7c) | Legacy JSON and portable WinSCP INI migration, protection, rollback and verification. |
| [portable-ini-import.md](app-doc://article/material-winscp.repository.4229861b0f5762f6) | Detection of the real `WinSCP.ini` portable source and preservation of the app export path. |
| [import-validation.md](app-doc://article/material-winscp.repository.c97cbe640505c43a) | Malformed JSON errors, parser causes, and no-mutation import failure behavior. |
| [configuration-sanitization.md](app-doc://article/material-winscp.repository.15fb3a379bc605b3) | Startup normalization and atomic state-import rejection. |
