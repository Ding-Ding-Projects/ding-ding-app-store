---
layout: doc
title: "Accessibility"
description: "Keyboard, screen-reader, reduced-motion, contrast, and narrow-layout behavior across the hosted app and documentation."
section: "Operator contract"
---

Operator contract

# Accessibility

Accessibility is part of the feature contract, not a postscript. The app keeps controls
keyboard reachable, names live regions for assistive technology, shows visible focus, and
respects reduced motion. The docs site keeps the same skip link, focus treatment, bounded
overlays, and responsive article layout.

## What it covers

- Keyboard navigation through tabs, dialogs, command palette, search builders, date fields,
  notifications, and the native super-confirmation gate.
- Screen-reader names and states for live evidence, controls, notifications, search counts,
  empty results, and reduced-motion choices.
- Contrast-safe Material surfaces, focus rings, large hit targets, and bilingual strings
  that do not clip at supported widths and display scales.

## Configuration

The app's Settings page exposes language mode, independent funny levels, appearance and
reduced-motion preferences. The docs edition bar provides the static site's language and
funny-level controls; those preferences persist in this browser and style shell labels,
while article facts remain exact.

## Failure modes

If a browser or assistive technology cannot expose a requested capability, the app keeps the
semantic control and reports the limitation rather than hiding it. A missing live entity or
command is a real service error, never a fake success.

## Security considerations

Accessibility preferences are local presentation state. The docs site has no analytics,
third-party scripts, or credential intake. Do not include real Home Assistant tokens or
private entity details in screenshots, exports, or issue comments.

## Verification

Run the app's accessibility checks and manually traverse each changed surface with a
keyboard at 390 px and desktop widths. Confirm focus return after dialogs, invalid and empty
search states, reduced-motion rendering, contrast, and the docs command palette shortcut
Ctrl+Shift+F. The Pages build must complete before publishing.

## Suggested articles

- Appearance editor — contrast, density, fonts, and persisted theme controls.
- Command palette — keyboard-first access to every destination.
- Feature briefs — the complete docs index.
