# Broad editor support

Desktop Material's supported Windows catalog includes Visual Studio
Code/VSCodium variants, JetBrains IDEs, Sublime Text, Vim/Neovim front ends,
and other Windows editors. Discovery uses validated application registration
metadata and known executable locations. A custom executable/argument
integration remains available when a supported editor is installed elsewhere
on Windows.

Discovery checks registration/path metadata and never starts a candidate.
Duplicate editions stay distinguishable, missing executables are skipped, and
the selected value falls back with clear Preferences guidance. Launches do not
use a shell. Custom argument parsing, process output, and time are bounded.

Windows editor discovery, custom integration, and launch tests verify these
contracts. The product support boundary is documented in
[Windows-only platform support](app-doc://article/desktop-material.repository.c835f0962aed9b0f). WSL editions
are covered by
[WSL-aware editor opening](app-doc://article/desktop-material.repository.67342ac87c7e8b49), and entry points by
[One-click editor actions](app-doc://article/desktop-material.repository.3b0a16f116487741).
