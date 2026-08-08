# Search and regex builder

> **Status: shipped.** This wiki page is generated from the canonical categorized article.

## Behaviour

Discover, Installed, Updates, Documentation, Activity, every Settings sub-tab, the command palette, tab rail, and appearance-element list each own an independent search state. Plain text is the default. The adjacent `.*` action opens the shared guided builder anchored to that field, with literals, character classes, anchors, groups, alternation, quantifiers, raw pattern, `i/m/s/u` flags, sample text, syntax feedback, live match text, capture-group computation, copy, and apply.

Applying a pattern synchronizes the originating query, pattern, flags, and visible filter. Clearing one field clears only that surface. The command palette can open the builder for any named search surface.

## Configuration

Search state is session-only and never persisted, avoiding a startup view that silently hides content. Patterns are limited to 160 characters, samples to 10,000 characters, collection haystacks to 4,096 characters, and previews to 100 matches. Global mode is the JavaScript `RegExp` dialect; `g` is controlled internally for preview and not exposed as a user flag. A strict `worker-src 'self'` policy keeps preview code in the renderer's isolated worker boundary.

## Failure modes

Invalid patterns, unsupported flags, lookaround, backreferences, oversized repetition, and known nested-quantifier or quantified-alternation shapes produce inline syntax feedback and match nothing until corrected. Empty plain-text input matches everything. Zero-width matches are counted safely in the worker and are not highlighted as empty marks. A worker generation and `AbortSignal` cancel stale keystrokes, the worker enforces a 100 ms evaluation budget, and the UI terminates it after 150 ms. Worker payloads and results are validated and clipped before they reach React.

## Security considerations

Patterns and samples remain local and are not written to settings, catalog requests, or history. Rendering uses React nodes rather than pattern-generated HTML. The worker has no DOM, Electron, IPC, filesystem, or network access. Input bounds, fail-closed admission, generation checks, cancellation, and timeout reduce memory and CPU exposure; synchronous collection filtering uses the same safety contract and a 4,096-character haystack cap.

## Verification

Shared contract tests enumerate persisted surfaces and the command registry checks a builder command for every search. Type checks exercise the one shared component. Focused regex cases cover valid, invalid, unsupported flags, adversarial, plain-text, Unicode, multiline, capture, zero-width, bounded result text, and cancellation contracts; runtime keyboard focus across every anchored popover remains a separate visual/interaction gate. A packaged capture of each search surface remains runtime evidence rather than a claim from static tests.

## Suggested articles

- [Tab workspace](Tab-Navigation)
- [Command palette](Command-Palette)
- [Offline documentation browser](Offline-Documentation-Browser)
