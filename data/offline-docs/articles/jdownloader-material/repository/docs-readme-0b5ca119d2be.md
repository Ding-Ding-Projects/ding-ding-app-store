# Documentation index

This is the canonical documentation map for the Windows desktop application. **Implemented** means
the named behavior exists in the current desktop source. It does not predict a GitHub release:
local and remote evidence are recorded separately in HANDOFF.md and the
[delivery verification guide](app-doc://article/jdownloader-material.repository.02f19cac510ee90e).

| Category | Scope | Current status |
| --- | --- | --- |
| [Desktop experience](app-doc://article/jdownloader-material.repository.9f08d6582b2cf061) | language and humour, notifications, changelog, dim-sum surprise | Implemented |
| [Appearance](app-doc://article/jdownloader-material.repository.7f6e7d4e0f3b5cbc) | Material 3 tokens, per-element editing, fonts, colors | Implemented |
| [Navigation](app-doc://article/jdownloader-material.repository.77bc90bc1f1f4ef1) | browser-style tabs, pinning, grouping, tab discovery and bulk close | Implemented |
| [Search](app-doc://article/jdownloader-material.repository.0239f3b61dfcf440) | plain search and bounded RE2/J regex builder | Implemented |
| [Data and history](app-doc://article/jdownloader-material.repository.c1a935b9f04d2766) | restart recovery and append-only local revisions | Implemented |
| [Integrations](app-doc://article/jdownloader-material.repository.aedcd4fc22d25afd) | external editor and installed-JDownloader loopback bridge | Implemented |
| [Delivery](app-doc://article/jdownloader-material.repository.20840e582995a8f0) | CI, Windows installer, release photo, Pages, wiki and verification | Implemented locally; remote proof pending |
| [API](app-doc://article/jdownloader-material.repository.ac0e4a04bf399f08) | inbound HTTP/API and Postman applicability | Not applicable |

Existing detailed references remain authoritative for shipped transfer behavior:

- [Architecture](app-doc://article/jdownloader-material.repository.ff21b6b9a3a33e9d)
- [Engine API](app-doc://article/jdownloader-material.repository.5333cc60bc6fa2d0)
- [History](app-doc://article/jdownloader-material.repository.03357ad51eea15a5)
- [Design system](app-doc://article/jdownloader-material.repository.b9356668f945997c)
- [UI guide](app-doc://article/jdownloader-material.repository.ea53de5a3bcbba32)
- [Feature reference](app-doc://article/jdownloader-material.repository.dc0e817dee8ad163)
- [Verification handoff](app-doc://article/jdownloader-material.repository.d80ab157289480e9)

Every feature document states behavior, configuration and persistence, failure modes, security and
privacy, verification, and an honest implementation status. Update the relevant category index,
`README.md`, tracked `wiki/`, Pages source, `ROADMAP.md`, and `HANDOFF.md` with each desktop change.
