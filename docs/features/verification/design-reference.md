---
id: design-reference
title: Deterministic design reference and visual evidence
titleYue: 可重現設計參考同視覺證據
category: verification
status: limited
summary: Renders the checked-in reference files directly, defines exact reference and packaged-runtime scenes, and refuses to call pending pixels current evidence.
---
# Deterministic design reference and visual evidence

## Behaviour

The repository ships a plain Electron developer viewer that renders the real checked-in `design/reference.html`, `design/reference.mjs`, and `design/reference.css` files directly. `tools/design-reference/scenes.json` is the hand-written source of truth for 27 capture scenes: 11 base destinations/settings states, 11 independent overlay states, and five theme, width, and language variants. Tab management and the tab context menu are separate scenes. English, Cantonese, bilingual, dark, compact, and narrow layouts have explicit tuples instead of being inferred from filenames.

Every scene records the exact page, Settings subtab or overlay alias, theme, locale, viewport, scale, packaged-runtime semantic action plan, readiness selector, and fixed evidence paths. The reference viewer translates that record into the real query parameters consumed by the design files. The packaged-runtime route is a drive plan for the real built artifact; it never injects replacement markup or renderer state.

Compare mode loads the scene's actual fixed `comparison.png` from the main-process-owned evidence directory. It fails before opening a window when that file is absent. A banner or a second rendering of the reference is not accepted as comparison evidence.

## Configuration

Run `npm run design:reference -- --scene=<id>` to render a reference scene and `npm run design:plan -- --scene=<id>` to print its packaged-runtime plan. The package script defaults to `catalog`; passing an explicit `--scene` later in the argument list overrides that default. Run `npm run design:compare -- --scene=<id>` only after the corresponding labelled comparison image exists.

Reference routes use `?page=`, optional `?settings=`, optional `?overlay=`, `?lang=`, `?theme=`, and an evidence row identifier. The viewer accepts only registered scenes. It owns the reference/evidence paths, denies permissions and new windows, blocks network requests and navigation, uses a fixed isolated partition, and keeps renderer Node integration disabled.

## Failure modes

An unknown scene, invalid mode, missing comparison image, invalid tuple, missing packaged-runtime action, stale reference digest, duplicate evidence path, absent language/width/theme state, or incomplete screen-specific Material Design 3 audit fails closed. Final reference, built, labelled comparison, diff, and receipt hashes intentionally remain pending while catalog integration is active. They must be captured again from the final reconciled commit; older README images are historical context and cannot satisfy that final Chut.

## Security considerations

The viewer never accepts an arbitrary path, URL, command, or executable argument from the renderer. The built plan contains only allowlisted semantic actions and selectors against the App Store window. Captures use the sanctioned isolated hidden-desktop route; the visible desktop, pre-existing application profile, and unrelated browser state stay untouched. Evidence receipts contain the exact source commit, packaged artifact digest, capture tuple, image digests, and machine-readable diff summary, but no credentials or private infrastructure.

## Verification

`node scripts/design-parity-plan.mjs --self-test` deliberately removes a scene, corrupts a tuple, and supplies a wrong reference alias; each probe turns red, then the restored registry turns green. `npx vitest run tests/design-parity-contract.test.ts` independently checks exact membership, real reference queries, packaged-runtime plans, reference-file digests, unique evidence paths, tuple parity, screen-specific Material Design 3 audits, compare-mode fail-closed behavior, and the explicit pending-final-capture state.

The current checked-in gallery predates the final reconciled capture run. In particular, the historical Updates and tab-actions files are byte-identical and therefore do not prove two different states. The final gallery must replace those claims with unique, inspected pixels from the exact packaged artifact.

## Suggested articles

- [Verification and evidence](verification.md)
- [Expressive storefront shell](../experience/expressive-storefront.md)
- [Command palette](../experience/command-palette.md)
- [Tab workspace](../experience/tab-navigation.md)
