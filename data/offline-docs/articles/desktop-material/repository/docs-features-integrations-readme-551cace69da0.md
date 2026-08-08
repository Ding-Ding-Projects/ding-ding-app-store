# Integrations

Desktop Material integration features connect Git workflows to operating-system,
editor, shell, provider, and user-level Git configuration without placing
credentials or machine-specific state in a repository.

- [App-hosted browser](app-doc://article/desktop-material.repository.246d4eac709d54c8) — open HTTP(S) links in a
  sandboxed `WebContentsView` tab with address/navigation controls, bookmarks,
  popup and redirect capture, a persisted internal/external choice, and an
  isolated authentication escape. Combined local tests, the exact Windows
  production build, and hidden-desktop acceptance pass; packaged E2E and
  remote publication remain separate.
- [Windows-only graphical edition support](app-doc://article/desktop-material.repository.c835f0962aed9b0f)
- [Windows Explorer context menu and quick-action
  window](windows-explorer-context-menu.md)
- [Automated update build status and release
  notes](automated-updates-and-release-notes.md)
- [Self-hosted Windows dependency bootstrap](app-doc://article/desktop-material.repository.68a5aca639fa42f1)
- [Build & Run output controls](app-doc://article/desktop-material.repository.bf2696656cc4d09f)
- [Actions workflow manager](app-doc://article/desktop-material.repository.76b7288b91f30e74) — workflow timing,
  bounded job-log transfer retries, and visible recovery actions for transient
  provider 404 responses.
- [Local GitHub Actions runner](app-doc://article/desktop-material.repository.579a715c69d5986b)
- [Local AI build repair with Codex or
  OpenCode](local-ai-build-fix.md)
- [Custom Git command presets](app-doc://article/desktop-material.repository.d39a563605b37bc0)
- [WSL-aware editor opening](app-doc://article/desktop-material.repository.67342ac87c7e8b49)
- [Global ignore management](app-doc://article/desktop-material.repository.b5e0d15acdb6cc0e)
- [Editor discovery and one-click
  opening](editor-discovery-and-one-click-opening.md)
- [One-click editor actions](app-doc://article/desktop-material.repository.3b0a16f116487741)
- [Duplicate-open guard](app-doc://article/desktop-material.repository.09af43151689e789)
- [Broad editor support](app-doc://article/desktop-material.repository.0ca797463349948f)
- [Copilot commit-message controls](app-doc://article/desktop-material.repository.99eb09bc535a4de8)
- [Ollama model manager](app-doc://article/desktop-material.repository.d0ba43a29e7c9e23)
- [Repository-bound GitHub API functions](app-doc://article/desktop-material.repository.37b172fd362f0357)
- [GitLab merge requests](app-doc://article/desktop-material.repository.14a03af71e40a299)
- [Repository Releases dashboard](app-doc://article/desktop-material.repository.f9564393ee2fdea5)
- [Per-repository GitHub Packages explorer](app-doc://article/desktop-material.repository.2e8e100f04168f0a)
- [SSH working copies and remote
  clone](ssh-working-copy-and-remote-clone.md)
- [GitHub CLI push credential
  fallback](gh-cli-push-fallback.md)

Credential and sign-in prompts are serialized through one recoverable FIFO so
concurrent Git/SSH requests cannot lose their visible completion path. See the
cross-cutting [responsiveness and resource lifecycle
contract](../quality-and-reliability/responsiveness-and-resource-lifecycle.md).
