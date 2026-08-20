# Protocols

Every transfer backend in WinSCP Material implements the same adapter contract,
defined in `design/main/protocols/base.js`. The UI never asks a backend to do
something it has not declared it can do: each adapter publishes a `caps` object,
and commands the protocol cannot support are greyed out rather than failing at
run time.

> [!IMPORTANT]
> **Postman collections are not applicable to this category, or anywhere else in
> this project.** WinSCP Material is a desktop client for SFTP, SCP, FTP/FTPS,
> WebDAV and S3. It exposes no HTTP API of its own, hosts no server and offers
> no REST endpoint, so there is nothing a Postman collection could exercise.
> WebDAV and S3 are carried over HTTP, but they are *outbound* protocol clients
> talking to third-party servers, not an API this project publishes. No Postman
> artefacts are invented to satisfy a checklist.

## Articles

| Article | Covers |
| --- | --- |
| [adapter-contract.md](app-doc://article/material-winscp.repository.77c1e7f43ee4268a) | The interface every backend implements, and how `caps` drives the UI. |
| [remote-files.md](app-doc://article/material-winscp.repository.702fa5e92d4cfecf) | Shared remote listing rows, POSIX/VMS path rules, metadata, symlink refusal, and directory-size semantics. |
| [sftp.md](app-doc://article/material-winscp.repository.07a5111c637447e9) | SFTP over SSH — versions 3–6, packet sizing, queueing, server bugs. |
| [scp.md](app-doc://article/material-winscp.repository.5dc0057fa313f047) | SCP and the shell session it depends on. |
| [ftp.md](app-doc://article/material-winscp.repository.cc7ca4876e7e9ab0) | FTP, FTPS (explicit and implicit), passive-host policy, active mode, MLSD, TLS session reuse, resume and encoding/error behaviour. |
| [ftp-mlsd-fallback.md](app-doc://article/material-winscp.repository.00493664a3e643e7) | Why `MLST` does not imply `MLSD`, and how directory listings fall back safely to `LIST`. |
| [webdav.md](app-doc://article/material-winscp.repository.84ede37559ada49f) | WebDAV and WebDAVS, XML listings, escaping, redirect origin isolation, and legacy authentication. |
| [webdav-range-resume.md](app-doc://article/material-winscp.repository.051807bafb7e5f4c) | Safe HTTP byte-range reads for resumed WebDAV downloads, and why uploads remain non-resumable. |
| [s3.md](app-doc://article/material-winscp.repository.968e9ab43a8535ed) | Amazon S3 and S3-compatible endpoints, URL styles, pagination, multipart copy, and storage classes. |
| [s3-multipart-abort.md](app-doc://article/material-winscp.repository.8fb24cbe469a511e) | Idempotent cleanup of failed, cancelled and incomplete multipart uploads. |
| [local.md](app-doc://article/material-winscp.repository.7efc8c0b4fe079f1) | The local filesystem backend and Windows path handling. |

## Capability matrix

The flags below are what `caps` advertises. A blank cell means the UI disables
the corresponding command for that protocol.

| Capability | SFTP | SCP | FTP/FTPS | WebDAV | S3 | Local |
| --- | :-: | :-: | :-: | :-: | :-: | :-: |
| Directory listing | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Upload / download streaming | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Resume partial transfers | ✅ | | ✅ | | | ✅ |
| Rename / move | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Set POSIX permissions | ✅ | ✅ | partial | | | |
| Set timestamps | ✅ | ✅ | partial | | | ✅ |
| Symbolic links | ✅ | ✅ | | | | ✅ |
| Hard links | ✅ | | | | | ✅ |
| Server-side copy | ✅ | ✅ | | ✅ | ✅ | |
| Checksums | ✅ | ✅ | partial | | ✅ | ✅ |
| Arbitrary shell commands | | ✅ | | | | |
| Recycle bin | ✅ | ✅ | ✅ | ✅ | | ✅ |

"partial" means the capability depends on what the specific server advertises,
so it is resolved after connecting rather than assumed.

## Cross-cutting behaviour

- **Paths are POSIX inside an adapter**, always — with `local.js` overriding
  `sep`, `normalize`, `join`, `dirname` and `basename` for Windows. Anything
  that builds a path by string concatenation is a bug.
- **Listings are uniform.** `list()` builds every row through `entry()`, so
  every column the UI renders exists for every protocol even when the server
  cannot supply it. A missing value is explicitly absent, never a guessed one.
- **Streaming is the transfer path.** `createReadStream` / `createWriteStream`
  carry files; `readFile` / `writeFile` exist for the editor and small files.
- **Timeouts and keepalives** are per-site (`timeout`, `pingInterval`,
  `pingType`) and apply the same way across protocols.

## Suggested articles

- Transfers and the queue — what happens to a stream once a protocol hands it over.
- Security and credentials — host keys, certificates and how secrets reach an adapter.
- Sessions and sites — where per-protocol options are configured and stored.
