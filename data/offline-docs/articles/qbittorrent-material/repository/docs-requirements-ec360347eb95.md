# Build directives (authoritative)

These are the user's explicit requirements for the qBittorrent Material rewrite. Every generation subagent must honor them.

## Core
1. **From-scratch rewrite** in C++/Qt6 — no copy-paste of the old Qt Widgets code. Fresh architecture.
2. **Entire UI is QML + Material Design** (Qt Quick Controls 2 Material style). *Every* window AND *every* dialog is Material — no native/Widgets dialogs except unavoidable OS file pickers.
3. **Engine** wraps `libtorrent-rasterbar` 2.x (a fresh Session/Torrent layer, exposed to QML via QObject models/controllers).
4. **Feature-for-feature clone** of qBittorrent's desktop client — clone features one by one from the FEATURE_SPEC inventory.
5. New repo under GitHub owner **codingmachineedge**; commit author **Claude <noreply@anthropic.com>**.
6. Delivery: **one subagent per feature**, fanned out in parallel; **commit each feature and git push incrementally**.

## Aggressive logging (required everywhere)
- A first-class logging subsystem used pervasively: engine lifecycle, every libtorrent alert, every Session/Torrent state change, every user action (button clicks, menu actions, dialog opens/confirms), every settings change, every model reset/update, app startup/shutdown, errors/warnings with context.
- Levels: TRACE, DEBUG, INFO, WARNING, CRITICAL. Default build logs verbosely (DEBUG) with the ability to raise the threshold.
- Dual sink: rotating **log file** on disk AND the in-app **Execution Log** screen (Material). Include timestamps, category tags (`[engine]`, `[ui]`, `[session]`, `[model]`, `[i18n]`, etc.), thread id.
- Provide a `Log` C++ singleton + QML-accessible logging (`Log.debug(...)`, `Log.info(...)`) so QML UI actions also log. Wrap Qt's categorized logging (`QLoggingCategory`).
- Every non-trivial function of note should emit at least an entry/exit or action log at TRACE/DEBUG.

## Languages (three modes, runtime-switchable)
Implement a **custom i18n layer** (not raw Qt .ts) — a QML singleton `I18n` with an observable `language` property and a `t(key)` / `qsTrx` function, because two of the three modes are non-standard.

Modes:
1. **English** — clean, standard English UI strings.
2. **Cantonese (Hong Kong Style Funny)** — colloquial *written* Cantonese (港式口語, real Cantonese characters like 嘅/係/喺/咗/唔/佢/嘢), with a humorous, cheeky Hong Kong tone. Not formal Standard Written Chinese. e.g. Pause → "唞下先", Delete → "掟咗佢", Resume → "做返嘢", Force Recheck → "查家宅". Keep it fun but still understandable as the actual function.
3. **Bilingual** — shows BOTH: English and Cantonese together, e.g. `Pause 唞下先` (English first, then Cantonese, separated by a thin space or ` · `). Implemented by composing the English + Cantonese strings, not a third catalog.

Requirements:
- A single **string catalog** keyed by stable IDs; each entry has `en` and `yue` (Cantonese). Bilingual = compose(en, yue).
- Language chosen in Preferences → Behavior, applied at runtime (all visible text updates live via bindings — no restart).
- Every user-visible string in every screen/dialog goes through `I18n` — no hard-coded literals in QML text.
- Persist the chosen language in settings.

## Notification-first UX (dialogs → less disruptive)
Transform the app to be less disruptive than modal dialogs:
- **Confirmations / alerts / info** (delete confirm, exit confirm, shutdown, "are you sure", errors, "search finished", "added to tray", statistics/about quick info) → **in-app snackbar notifications** via the global `Snackbar` queue, with inline action buttons where relevant (e.g. optimistic delete + **UNDO**, or **CONFIRM / DISMISS**). Add a **notification center** (bell icon in the toolbar) listing recent notifications.
- **Input forms** (Add Torrent, Preferences/Options 9 tabs, Torrent Options, Torrent Creator, RSS auto-download rules, category/tags editors) → **non-modal slide-in side sheets** (Material side-sheet pattern): they slide in from the right, do NOT dim/block the rest of the app, and can be dismissed by clicking away. Keep all inputs.
- Prefer optimistic action + undo over blocking "are you sure?" prompts.
- No modal `Dialog { modal: true }` centered popups for routine flows. Reserve true modality only for genuinely destructive irreversible actions if any remain.
- Implementation: a `NotificationController` (C++ singleton) + `NotificationCenter.qml` + a reusable `SideSheet.qml` component; refactor existing `*Dialog.qml` files to either emit snackbars (confirmations) or become `SideSheet` content (forms). Verify by building + screenshotting.
