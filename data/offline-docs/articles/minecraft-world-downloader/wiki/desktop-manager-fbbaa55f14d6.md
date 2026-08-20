# Windows desktop manager

The Windows WPF manager runs the Dockerized console and exposes BlueMap and auto-explore helpers without requiring command-line entry.

## New desktop foundations

- Four persistent M3-styled tabs: **Downloader**, **Settings**, **Regex builder**, and **Notifications**.
- English, playful Hong Kong-style Cantonese, and bilingual preferences with independent funny levels from 1–5.
- Searchable settings with an anchored .NET regex builder. Plain text remains the default; regex evaluation is local, length-bounded, result-capped, and limited to 150 ms.
- A full .NET regex workbench with guided constructs, `i`/`m`/`s`/`n` flags, sample text, syntax feedback, matches, capture groups, copy and Markdown/text export.
- Theme, large text, font, language, humour, external editor and dim-sum opt-out persist across launches.
- Informational and non-decision errors appear as corner notifications and remain reviewable in Notifications.
- The optional 1% startup delight chooses one of three bundled offline dim-sum illustrations and never takes focus.

## Security

The console password is encrypted with Windows DPAPI for the current user in the normal settings file. Docker command output redacts sensitive environment values, and generated Compose strings are escaped so quotes/newlines cannot alter YAML structure. A Compose file explicitly exported with login protection still contains the deployment password and should be protected like any other secret-bearing configuration file.

## Verification

The desktop project builds with .NET 8, its ten regression tests cover security/localization/regex behavior, and the real WPF app is captured through the Lowlevel MCP off-screen desktop harness. See the repository feature documentation for commands and evidence.
