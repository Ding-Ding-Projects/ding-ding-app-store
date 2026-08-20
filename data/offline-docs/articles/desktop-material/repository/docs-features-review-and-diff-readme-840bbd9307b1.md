# Review and diff features

This category documents in-app presentations for safely reviewing repository
changes without changing Git's underlying patch or selection behavior.

## Features

- [Changed-file tree view](app-doc://article/desktop-material.repository.a1bfa0cac4a9cb2e)
- [Expanded diff context](app-doc://article/desktop-material.repository.cc50cf684fe46d2f)
- [Structured CSV and TSV diffs](app-doc://article/desktop-material.repository.7bd95da03cf97c13)
- [TGA image previews](app-doc://article/desktop-material.repository.eab213879b824d74)
- [Structured data and TGA previews](app-doc://article/desktop-material.repository.6b7b585eaf3f8814) —
  review bounded CSV/TSV changes as an accessible table and supported TGA
  images as ordinary image diffs, with deterministic fallback behavior.
- [Changed-file trees and diff context](app-doc://article/desktop-material.repository.f2c509d50f118b8a)
  — organize nested changed paths without changing file actions, and persist
  bounded context-expansion preferences.

## API applicability

These features operate on local file and Git blob contents. They add no HTTP
endpoint, so a Postman collection is not applicable.
