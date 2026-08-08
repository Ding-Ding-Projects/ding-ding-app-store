# Windows features

- [Windows-only platform policy](app-doc://article/bambu-studio.repository.7780d9ec74d86a18)
- [Native Material Design 3 UI](app-doc://article/bambu-studio.repository.5cd127375ec6a9aa)
- [Keyboard, assistive, and responsive GUI accessibility](app-doc://article/bambu-studio.repository.5d412b8f2598d405)
- [English, Hong Kong Cantonese, and bilingual modes](app-doc://article/bambu-studio.repository.9c2890fa28ffb465)
- [Ink terminology (filament → ink, AMS → Ink Dispenser)](app-doc://article/bambu-studio.repository.8d038ec6faf5fa75)
- [Appearance customization](app-doc://article/bambu-studio.repository.346e4a74d0107b48)
- [Regex builder](app-doc://article/bambu-studio.repository.342a6d476a3387ef)
- [Command palette (Ctrl+F)](app-doc://article/bambu-studio.repository.5082e5724414f744)
- [Prepare sidebar search (settings + filament slots)](app-doc://article/bambu-studio.repository.57791ab7760ca0e1)
- [Material color picker & color translator](app-doc://article/bambu-studio.repository.3139fcb953987d46)
- [Bulk filament actions](app-doc://article/bambu-studio.repository.5556639c940622a2)
- [Stop-print safety interlock](app-doc://article/bambu-studio.repository.b101ffdf871a614e)
- [Print simulation playback (feedrate-true)](app-doc://article/bambu-studio.repository.bad235860284e30a)
- [AI printer watch (local models)](app-doc://article/bambu-studio.repository.25dfbd691912fb04)
- [AI filament scanner (QR phone upload → AMS slot)](app-doc://article/bambu-studio.repository.eab9499f47a22fea)
- [Smart home: printer handover, TTS narrator, and alert lights](app-doc://article/bambu-studio.repository.3f05cdc9f4c54350)
- [Release splash art (fresh dim sum per release)](app-doc://article/bambu-studio.repository.1866c76888d6a267)
- [Native visual smoke test](app-doc://article/bambu-studio.repository.8b000a0bbe0e84d0)
- [Cloud web-page failure recovery](app-doc://article/bambu-studio.repository.63108283422c1015)
- [Software OpenGL fallback (Mesa llvmpipe)](app-doc://article/bambu-studio.repository.5e7e8f89925613cc)

Windows is the active release target for this fork. macOS and Linux source support remains upstream,
but those platforms are not part of the fork's release acceptance gate.

The native application now exposes one tightly scoped HTTP contract only while the user explicitly
enables Home Assistant printer discovery. Its endpoint, security boundary, and Postman collections
are documented under [HTTP/API features](app-doc://article/bambu-studio.repository.a88917a07ea8b9da). It is a short-lived credential handover,
not a general remote-control API.

The `DeviceWeb` sub-project (`src/slic3r/GUI/DeviceWeb/`) remains an in-app webview front-end bundled
with the application, not a served HTTP API; this repository publishes no separate API contract for
it.
