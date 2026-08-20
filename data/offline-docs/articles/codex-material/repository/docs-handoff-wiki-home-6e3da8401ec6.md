# Codex Studio

A Material 3 **Windows desktop GUI wrapping the OpenAI Codex CLI**. It composes flags, runs the real `codex` binary, streams what it says, and reads your real `~/.codex`. It never reimplements the agent, the sandbox, the config schema or the plugin system.

- **[Documentation site](https://ding-ding-projects.github.io/codex-material/site/)** — every feature, with its own article
- **[Releases](https://github.com/Ding-Ding-Projects/codex-material/releases)** — NSIS `.exe` and MSI, unsigned
- **[Repository documentation](https://github.com/Ding-Ding-Projects/codex-material/tree/main/docs)**

## Install

Take the newest release. Both files install the same build, per user, without administrator rights.

| File | Use it when |
|:--|:--|
| `Codex.Studio-0.1.0-x64.exe` | Installing yourself |
| `Codex.Studio-0.1.0-x64.msi` | Deploying to managed machines |

The installers are **not code-signed**, so SmartScreen warns on first run.

> Releases `build.2` through `build.9` are the earlier Tauri shell and render a blank window. They carry a warning and are superseded.

## The bundled Codex CLI

Each installer carries the Codex CLI (~410 MB unpacked) so a machine that has never installed Codex works immediately. Resolution order:

    CODEX_BIN  →  codex on PATH  →  the bundled copy

Your own install always wins: it owns your login and your `~/.codex`.

## Build from source

    git clone https://github.com/Ding-Ding-Projects/codex-material
    cd codex-material
    npm install
    npm start          # run it
    npm test           # the test suites
    npm run capture    # 25 screenshots, headless — exits non-zero if the app fails to render
    npm run dist       # NSIS + MSI into dist/

## Where things live

| Path | What it owns |
|:--|:--|
| `app/` | The renderer: template, runtime, i18n, tabs, notifications, changelog, dim sum |
| `electron/` | Main process, preload allow-list, and six backend modules |
| `tools/` | Tests, the capture harness, CLI staging, generators |
| `docs/` | Repository documentation and the published site under `docs/site/` |

## Language

Three modes — English, playful Hong Kong Cantonese, and bilingual — with **two independent
funny-level sliders**, 1 to 5, one per language. Humour styles the voice, never the facts: a
destructive label still reads as destructive at level 5, and every placeholder survives.

**Every user-visible string goes through the string table** — 649 keys, 468 call sites. Seven
literals remain literal on purpose, each with its reason recorded in the test that allows it:
three CLI command names (`codex login`, `codex logout`, `codex cloud`), two typeface names
(Georgia, Helvetica Neue), `廣東話` — a language's name in its own language — and the empty
sentinel a dropdown clears itself with.

That is checked by a test rather than a grep. The grep it replaced looked only at `label: "…"`,
which cannot see a positional argument to `pick()`/`toggle()`/`slider()`/`action()`, a command
palette's `group` or `hint`, or a label inside a ternary — so it reported 92 remaining strings
when the real figure was over 200.

## Honest limitations

- Nothing installs and launches the artifact on a clean machine, so "it installs" is not among the things CI verifies.
- The installers are **not code-signed**; that needs a certificate this project does not have.
- Each chat message is its own `codex exec` invocation — there is no resumed interactive thread yet.
- Levels 1 and 2 of the funny sliders are identical for most one- and two-word labels, where inventing a distinct level 2 for "Chats" or "Hue" would make the interface worse rather than more compliant. Sentence-length keys do differ at every level.
- The appearance editor has no swatch grid, eyedropper or saved palettes, no search bar inside the popover, and nothing non-typographic per element (no radius, border, spacing or per-state targeting).
- `density` and `reducedMotion` are stored in settings and read by nothing.

## Verified state

Run these five; every figure the repository quotes comes from them.

    node tools/test-frontend.mjs    # 27 passed
    node tools/test-backend.mjs     # 33 passed
    node tools/capture.mjs          # 25 shots, exit 0
    node tools/audit-ui.mjs         # 23 findings, 0 severity high
    node tools/smoke.mjs            # PASSED

All 23 remaining audit findings are the harness noting a **deliberately** ellipsised label —
evidence a label no longer fits its box, not a defect. There are no unaddressed real findings.
Before this was worked through there were 228 unique findings across 1646 occurrences.

Screenshots are captured against an **authored `CODEX_HOME`**, never the operator's own: an
earlier set had a real Windows username legible in seven images and a private repository name in
an eighth. A screenshot is a publication.

---

**中文：** 一個包住 OpenAI Codex CLI 嘅 Material 3 Windows 桌面介面。佢負責砌 flag、行真嘅 `codex`、即時串你睇佢講咩、讀你真嘅 `~/.codex`；個 agent、sandbox、設定格式、plugin 系統，一律唔會自己重寫。安裝檔**未簽名**，SmartScreen 第一次開會嘈。Installer 有齊 Codex CLI（解壓後約 410 MB），未裝過 Codex 嘅機開機即用；但你部機有 `codex` 嘅話一定用你嗰個 —— 你個登入同 `~/.codex` 係佢管。`build.2` 到 `build.9` 係舊嘅 Tauri 版，開出嚟一片白，已經標咗警告，唔好裝。介面有三種語言模式（English、廣東話、雙語），仲有兩條各自獨立嘅搞笑程度掣（1 至 5，每種語言一條）—— 搞笑只係改語氣，唔會改事實：第五級嗰句「刪咗佢」一樣睇得出係會刪嘢。介面每一句畀人睇嘅字都行晒字串表（559 個 key、327 個呼叫點）；剩低七個字面值係故意留低 —— 三個係指令名、兩個係字型名、一個係「廣東話」本身、一個係下拉選單清空用嘅空值，每個都喺測試度寫明點解。
