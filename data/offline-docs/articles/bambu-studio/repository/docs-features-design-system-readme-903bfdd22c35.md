# Design system

This category documents how the native wxWidgets/OpenGL application consumes the vendored Material
Design 3 design system.

- [Vendored Material Design 3 design system](app-doc://article/bambu-studio.repository.6d1e7d6e6182fa27) — token source of truth, the
  ground-up color/type/metric migration, contextual schemes, fonts, failure modes, and the parity
  audit result.
- [MD3 parity register](app-doc://article/bambu-studio.repository.b17c54511e345f1d) — the canonical element-by-element conformance
  register and wave plan driving the structural-anatomy migration. The register itself carries the
  live done / deviation / open counts; consult it rather than any snapshot elsewhere.

- [Themed surface colors on StaticBox cards](app-doc://article/bambu-studio.repository.45449e5b4c433a1a) — how a card gets its fill,
  why `SetBackgroundColorNormal()` could silently do nothing, and the stale constructor-time window
  background behind light plates in dark mode.
- [Generated visual showcase](app-doc://article/bambu-studio.repository.474a9ac7e1cc6a41) — the image suite shared by the
  interactive app, GitHub Pages landing page, and social preview, including loading, accessibility,
  deployment, and verification behavior.

## Design source

The canonical in-repo design source is `ui-md3/design-system/`.
Token values there match `src/slic3r/GUI/Widgets/MD3Tokens.hpp` exactly; the header is the native
source of truth that the C++ code resolves against.

## Postman collections

Not applicable. The design system is a compile-time token and typography layer for a desktop
application; it exposes no HTTP or API surface, so no Postman collection is provided for this
category.
