# Editor discovery and one-click opening

Desktop Material discovers a broad curated set of installed Windows editors,
including Visual Studio Code/VSCodium variants, JetBrains IDEs, Sublime Text,
and Vim/Neovim front ends. Users may instead configure a custom Windows
executable and arguments.

The chosen editor is available from repository rows, the Changes empty state,
changed-file context menus, conflict rows, and the diff header. File actions
open the selected path; repository actions open the working tree. Repository
Settings can override the app-level editor without affecting another repo.

Discovery checks known application registrations or executable locations and
never launches candidates merely to detect them. Launches use executable plus
argument arrays instead of a command shell. Custom integrations have explicit
timeout/output/error handling, and a missing executable routes to Preferences
without changing Git state.

WSL-targeted Visual Studio Code entries are documented separately in
[WSL-aware editor opening](app-doc://article/desktop-material.repository.67342ac87c7e8b49).

Verification includes Windows editor discovery suites, custom integration
argument tests, repository override tests, and the diff-header/context-menu UI
tests. See [Windows-only platform support](app-doc://article/desktop-material.repository.c835f0962aed9b0f)
for the release and CI boundary.
