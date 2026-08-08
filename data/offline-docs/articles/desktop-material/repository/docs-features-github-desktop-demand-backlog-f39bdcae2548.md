# GitHub Desktop demand backlog coverage

This ledger maps the 30 user-demand statements in the supplied research brief
to their Desktop Material implementation and feature contract. **Complete**
means the behavior is present in the application tree and has focused automated
coverage; release and headless acceptance evidence is recorded separately in
`HANDOFF.md`.

| # | Demand | Status | Feature contract |
|---:|---|---|---|
| 1 | Multiple accounts and per-repository identity | Complete | [Identity and account binding](app-doc://article/desktop-material.repository.0525532389f7683d) |
| 2 | Full in-app pull-request review | Complete | [PR review workspace](app-doc://article/desktop-material.repository.4bc1b237c93ce928) |
| 3 | Selective stash of chosen files | Complete | [Selective stashes](app-doc://article/desktop-material.repository.8292b08341cbbcd3) |
| 4 | Rich pull-request context and actions | Complete | [PR context and actions](app-doc://article/desktop-material.repository.313cd68842b142c6) |
| 5 | Complete tag lifecycle | Complete | [Tag lifecycle](app-doc://article/desktop-material.repository.baca3ed18aa437df) |
| 6 | In-app pull-request creation | Complete | [PR creation](app-doc://article/desktop-material.repository.671cabf14bdf4577) |
| 7 | Desktop notifications for PR activity | Complete | [PR notifications](app-doc://article/desktop-material.repository.44417dc9f8631eb2) |
| 8 | Multiple and named stashes | Complete | [Named Stash Manager](app-doc://article/desktop-material.repository.1e68f3b3676b0c0d) |
| 9 | Advanced history search and remote commits | Complete | [Advanced History](app-doc://article/desktop-material.repository.00dfdff70a3b129d) |
| 10 | Repository sidebar, pinning, and switching | Complete | [Repository sidebar](app-doc://article/desktop-material.repository.428374b789361f09) |
| 11 | Branch-switcher improvements | Complete | [Branch workflows](app-doc://article/desktop-material.repository.7a3a275662f542fe) |
| 12 | Checkout branches from other forks | Complete | [Fork branch checkout](app-doc://article/desktop-material.repository.05badc56dd267ab3) |
| 13 | Tree view for changed files | Complete | [Changed-file tree](app-doc://article/desktop-material.repository.a1bfa0cac4a9cb2e) |
| 14 | Repository-picker filters and visibility | Complete | [Picker filters](app-doc://article/desktop-material.repository.57e78e98091176b7) |
| 15 | Pull or fetch across reviewed repositories | Complete | [Batch sync](app-doc://article/desktop-material.repository.85395bec84832fce) |
| 16 | Recognize and manage external stashes | Complete | [External stashes](app-doc://article/desktop-material.repository.ca79245d073e1bdd) |
| 17 | WSL-aware editor and file integration | Complete | [WSL editor opening](app-doc://article/desktop-material.repository.67342ac87c7e8b49) |
| 18 | Structured CSV/TSV diffs | Complete | [Structured data diffs](app-doc://article/desktop-material.repository.7bd95da03cf97c13) |
| 19 | Custom Git commands and extensibility | Complete | [Custom command presets](app-doc://article/desktop-material.repository.d39a563605b37bc0) |
| 20 | Always-expanded and richer diff context | Complete | [Expanded context](app-doc://article/desktop-material.repository.cc50cf684fe46d2f) |
| 21 | One-click open in editor | Complete | [Editor actions](app-doc://article/desktop-material.repository.3b0a16f116487741) |
| 22 | Rich `.tga` image previews | Complete | [TGA previews](app-doc://article/desktop-material.repository.eab213879b824d74) |
| 23 | Broader external-editor support | Complete | [Editor discovery](app-doc://article/desktop-material.repository.0ca797463349948f) |
| 24 | Global Git ignore management | Complete | [Global ignore](app-doc://article/desktop-material.repository.b5e0d15acdb6cc0e) |
| 25 | Patch-series import and export | Complete | [Patch series](app-doc://article/desktop-material.repository.c6a70bdc8f5f55de) |
| 26 | Bulk local-branch deletion | Complete | [Reviewed branch deletion](app-doc://article/desktop-material.repository.29ffe063651d3116) |
| 27 | Network-drive and WSL repository paths | Complete | [Network paths](app-doc://article/desktop-material.repository.ae8b8944f23dc774) |
| 28 | Copilot commit-message controls | Complete | [Copilot controls](app-doc://article/desktop-material.repository.99eb09bc535a4de8) |
| 29 | In-app GitHub project-board view | Complete | [GitHub Projects](app-doc://article/desktop-material.repository.7bd8362b0d0945f6) |
| 30 | Offline cached project view | Complete | [Offline Projects](app-doc://article/desktop-material.repository.7bd8362b0d0945f6) |

The category indexes describe bounds, configuration, failure recovery,
security, and verification for each workflow. No item in this ledger creates a
new application HTTP endpoint, so no backlog-specific Postman collection is
applicable.
