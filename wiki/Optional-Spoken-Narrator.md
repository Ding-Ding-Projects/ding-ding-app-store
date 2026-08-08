# Optional spoken narrator

> **Status: shipped.** This wiki page is generated from the canonical categorized article.

## Behaviour

The spoken narrator is off by default. When enabled, it reads new corner-notification facts through the renderer's platform speech service. Users can choose English, Hong Kong Cantonese, or both; the bilingual choice always finishes English before it starts Cantonese. The queue speaks only one utterance at a time, replaces waiting stale lines when a newer notice supersedes them, and applies a short cooldown to routine categories. Error notices bypass that cooldown so a real failure is not hidden.

Funny-level controls style the spoken introduction only. The notification's factual message remains intact at every level. No notice text, credentials, or speech request leaves the renderer, and the feature does not use a privileged bridge, a network request, or a stored recording.

## Configuration

Settings → General exposes **Spoken narrator**, **Narrator language**, and **Reduce narrator sound**, each with explanation and fallback provenance. The persisted fallback keeps the narrator disabled, selects English then Hong Kong Cantonese for a later opt-in, and leaves reduced-sound disabled. The General settings search and its adjacent regex builder find all narrator controls.

Narration yields while the existing local quiet-hours window is active or when reduced-sound mode is on. Browser platforms intentionally do not reveal whether a screen reader is active; a future native accessibility integration can set the renderer's explicit `data-screen-reader-active` marker, and the narrator then yields rather than competing for speech.

## Failure modes

When `speechSynthesis` is unavailable, disabled by the platform, or fails an utterance, visual notifications and notification history continue normally. The narrator makes no retry loop and never claims that speech occurred. A platform voice may not provide a natural Hong Kong Cantonese voice; the request still uses `zh-HK` and delegates voice selection to the operating system.

## Security considerations

Speech is created only in the renderer from already-visible notification text. There is no IPC command, executable path, URL, secret, microphone access, cloud speech service, or audio recording. Narrator settings use the same validated main-process settings schema as the other non-sensitive user preferences.

## Verification

`tests/narrator.test.ts` proves disabled-by-default behavior, English-then-Cantonese ordering, factual funny-level wrapping, serial queueing, stale-line replacement, routine cooldowns, error delivery, and quiet/reduced-sound/accessibility yielding. `tests/settings-provenance.test.ts` guards the hand-written settings explanation inventory. Typecheck and production renderer builds check the renderer-only implementation.

## Suggested articles

- [Settings, language, and display name](./settings-language-and-display-name.md)
- [Notifications and operation status](./notifications-and-status.md)
- [Update schedule](Update-Schedule)
