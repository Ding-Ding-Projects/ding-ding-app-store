# Search and regex builder

> **Status: shipped.** This wiki page is generated from the canonical categorized article.

## Behaviour

Discover, Installed, Updates, Documentation, Activity, every Settings sub-tab, the command palette, tab rail, and appearance-element list each own an independent search state. Plain text is the default. The adjacent `.*` action opens the shared guided builder anchored to that field, with literals, character classes, anchors, groups, alternation, quantifiers, raw pattern, `i/m/s/u` flags, sample text, syntax feedback, live match text, capture-group computation, copy, and apply.

Applying a pattern synchronizes the originating query, pattern, flags, and visible filter. Clearing one field clears only that surface. The command palette can open the builder for any named search surface.

## Configuration

Search state is session-only and never persisted, avoiding a startup view that silently hides content. Patterns are limited to 160 characters, samples to 10,000 characters, and previews to 100 matches. Global mode is the JavaScript `RegExp` dialect; `g` is controlled internally for preview and not exposed as a user flag.

## Failure modes

Invalid patterns produce inline syntax feedback and match nothing until corrected. Empty plain-text input matches everything. Zero-width matches are counted safely in the builder but are not highlighted as empty marks. Copy failure follows the browser clipboard boundary. The implementation limits input and preview count but does not yet isolate evaluation in a worker with a hard time limit, so adversarial backtracking remains a documented limitation.

## Security considerations

Patterns and samples remain local and are not written to settings, catalog requests, or history. Rendering uses React nodes rather than pattern-generated HTML. Input bounds reduce memory pressure; future hardening should add cancellable worker evaluation for catastrophic-backtracking protection.

## Verification

Shared contract tests enumerate persisted surfaces and the command registry checks a builder command for every search. Type checks exercise the one shared component. Focused regex cases cover valid, invalid, plain-text, Unicode, multiline, capture, and zero-width behavior; runtime keyboard focus across every anchored popover remains a separate visual/interaction gate.

## Suggested articles

- [Tab workspace](Tab-Navigation)
- [Command palette](Command-Palette)
- [Offline documentation browser](Offline-Documentation-Browser)
