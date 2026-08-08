# Smart Home and Home Assistant

**File ▸ Smart home…** connects Bambu Studio to Home Assistant speakers, media players, and alert
lights, and can hand accessible printers to the companion
[`ha-bambulab`](https://github.com/Ding-Ding-Projects/ha-bambulab) fork.

The canonical implementation, security, failure-mode, and verification documentation remains in
the repository:

- Smart Home feature guide
- Five-minute printer-discovery API
- [Issue #16 evidence and hosted verdicts](https://github.com/Ding-Ding-Projects/BambuStudio/issues/16)

## Printer handover paths

The dialog offers two explicit, bounded paths:

1. **Token-free local discovery** publishes a fresh five-minute mDNS offer. Home Assistant shows a
   confirmation flow, then performs one capability-protected local fetch. The sharing toggle is off
   by default, never survives a dialog or app restart, and sends a zero-TTL goodbye when stopped.
2. **Authenticated Home Assistant service call** sends the selected printers to
   `bambu_lab.add_printer` over HTTPS. A bearer token is required. Plain remote HTTP, credentials in
   URLs, redirects, and oversized responses are rejected locally.

Printer access codes and pairing values are credentials. They are never written into repository
fixtures, URLs, logs, screenshots, issues, Discussions, or Postman collections. Both paths cap
active printers at 32 and report partial success without reflecting credential values.

## Performance and resilience bounds

- Entity fetches are single-flight and cancellable, query no more than four domains, accept at most
  4 MiB, parse at most 512 backend entities, and render at most 256 matching rows.
- Saved speaker and light lists are capped at 32 active values. Persisted-list inspection is bounded
  to 256 segments, 64 KiB total, and 256 bytes per value.
- Home Assistant work uses bounded executors rather than detached request threads. Volume changes
  are debounced, repeated Connect actions coalesce, and Path B printer requests run in four-wide
  waves. Even 32 unreachable printers therefore occupy at most eight 30-second timeout waves,
  instead of roughly 16 minutes of serial waiting.
- Light transactions are serialized and cancellation-safe. If cancellation arrives after a
  recovery scene is created but before any light is flashed, the unused scene is deleted instead
  of leaking in Home Assistant.
- Discovery admission uses a bounded request queue, a token bucket, response caching, 50 ms mDNS
  pacing, and lifecycle serialization to limit CPU, memory, and LAN amplification.

## Clipping correction and native evidence

The dialog is resizable with a declared 520×480 minimum. Its long body scrolls inside the available
work area while the header and decision footer stay fixed. Labels wrap, actions reflow, entity names
remain horizontally reachable, and labeled buttons retain their natural text width.

Native headless review found a real regression: a shared action helper combined a 44×44 minimum
target with shrink permission, turning **Previous**, **Play / Pause**, **Next**, and **Close** into
44-pixel squares. The helper now disables shrinking for labeled actions. Static layout checks pass
21/21, and the browser matrix passes 156/156 width/zoom/language combinations.

The final focused native suite passes **30 cases / 267 assertions**, and all **5/5** Home Assistant
CTest entries pass. The final incremental GUI relink completed in **214.808 s**, followed by a
no-change build in **8.544 s**. The final `BambuStudio.dll` is 151,299,584 bytes, timestamped
`2026-07-28 08:15:46 -04:00`, with SHA-256
`41BB1BFC754E3184C5908E2145A93E3640D3866E59380F32EEFF7A76F418E972`.
The primary corrected English captures
`dialog-720x760-after-text-action-fix.png`
and
`dialog-520x480-after-text-action-fix.png`
were recaptured from that exact final DLL and were bit-identical to the tracked images. The
media-action close-up uses the preceding
layout-identical `EBF646…` DLL; the later changes affect only printer-import scheduling and
alert-light cancellation cleanup, not dialog layout.

All captures are indexed under
[`docs/screenshots/smart-home/`](https://github.com/Ding-Ding-Projects/BambuStudio/tree/master/docs/screenshots/smart-home).
They are native English evidence. Native bilingual capture, a real Home Assistant confirmation
flow, and physical-printer verification remain separate open gates tracked in issue #16.
