# Public design reference notice

This directory is a static, offline design reference for Ding Ding App Store. It uses neutral fixtures solely to explain layout, states, and interaction boundaries. It is not a catalog feed, installer, release artifact, authentication surface, or telemetry client.

The reference contains no network requests, remote fonts, private repository names, credentials, user paths, or executable commands. Fixture labels and version strings are intentionally non-authoritative. The reference can be opened directly in a browser or through the plain Electron viewer in `tools/design-reference/main.mjs`.

The visual language follows Material Design 3 principles: a compact custom title bar, a persistent tab rail, tonal surfaces, accessible focus states, responsive narrow layouts, and reduced-motion support. Product behavior and security contracts remain defined by the application source and feature documentation, not by this static artifact.
