# Adding printers without the UI

This fork adds two ways for another program on your network — a slicer, a
script, an automation — to hand printers to Home Assistant instead of making you
retype every serial, host and access code into the config-flow UI.

Both end at the same place: the config flow's `import` step, which verifies the
printer and writes a normal config entry. They differ in **who starts it** and
therefore **what credential is involved**.

| | **A. Discovery** (no token) | **B. Service call** (token) |
| --- | --- | --- |
| Who initiates | Home Assistant, after the slicer advertises itself | The slicer |
| HA credential needed | **None** | A long-lived access token |
| Authorisation | The user confirms the discovery card in the HA UI | Whoever holds the token |
| Good for | A person setting up their own machine | Scripts, automations, unattended runs |

Neither one skips verification, and neither can create a duplicate.

---

## A. Discovery — no Home Assistant token at all

Home Assistant does not need to be told anything. The slicer advertises
`_bambu-slicer._tcp.local.` over zeroconf **while the user has sharing switched
on**, Home Assistant notices it and raises a discovery card, and the user
confirms.

```
slicer advertises  ->  HA discovery card  ->  user confirms  ->  import step  ->  config entries
```

**The confirmation replaces the token.** It does not remove the question of
authorisation — it moves it to the person sitting in front of Home Assistant,
which is why nothing is ever imported behind their back.

### Bambu Studio companion status

The matching implementation for
[BambuStudio#16](https://github.com/Ding-Ding-Projects/BambuStudio/issues/16)
keeps sharing off by default, explains that serial numbers, LAN addresses, and
access codes will be transferred, creates a fresh pairing token each time
sharing is enabled, and stops the offer when sharing is disabled or the dialog
closes.

As of 2026-07-28, the focused sharing-service targets compile, the focused
CTest set passes 5/5, and the native suite passes 30 cases with 267 assertions.
Path B admits four imports at a time, bounding a full 32-printer handover to at
most eight 30-second waves. Separately, cancelling a light-alert transaction
cleans up its temporary recovery scene.
A production-service cross-host probe observed the complete PTR/SRV/TXT/A
advertisement, completed the authenticated bounded offer fetch, and observed
the zero-TTL goodbye. The full Release GUI build passes with final corrected DLL
SHA-256
`41BB1BFC754E3184C5908E2145A93E3640D3866E59380F32EEFF7A76F418E972`.
Real Lowlevel headless English captures at 720×760 and 520×480 found a
text-action shrink/clipping defect; it was fixed, rebuilt, and recaptured.
Static checks pass 21/21, and the browser responsive matrix passes 156/156.
The fixture-matched Home Assistant 2025.1.4 clean functional suite passes 93/93,
including the targeted oversized-integer bad-payload regression at 1/1 and the
new serial/MQTT rejection group at 3/3. The
normal Windows invocation is blocked before test execution by the fixture
plugin's `pytest-socket` AF_INET socketpair incompatibility; the local result
used an in-memory Selector-loop/no-op-hook harness with no repository edits,
while the canonical unmodified Ubuntu workflow independently passed 93/93 in
3.36 seconds at
[run 30359258358](https://github.com/Ding-Ding-Projects/ha-bambulab/actions/runs/30359258358)
and published the tested
[`v3.0.7` HACS package](https://github.com/Ding-Ding-Projects/ha-bambulab/releases/tag/v3.0.7).
Hassfest passes; HACS repository validation remains blocked on the missing
fork/upstream license and owner decision in
[fork issue #1](https://github.com/Ding-Ding-Projects/ha-bambulab/issues/1).
Native bilingual capture, a real Home Assistant 2025.1.4
discovery/confirmation flow, a current-executor live REST run, and a
physical-printer success test remain pending.

### What the slicer must do

1. **Advertise** `_bambu-slicer._tcp.local.` on the LAN while sharing is on,
   with these TXT properties:

   | Property | Meaning |
   | --- | --- |
   | `pairing` | A fresh, high-entropy credential scoped to this sharing window |
   | `name` | Friendly name for the card, e.g. `BambuStudio on studio-pc` |

   The pairing value must be 32–128 URL-safe ASCII characters
   (`A–Z`, `a–z`, `0–9`, `.`, `_`, `~`, or `-`). Header delimiters, whitespace,
   and oversized TXT values are rejected before any HTTP request.

2. **Serve only** `GET /bambustudio/printers` on an ephemeral, unprivileged
   advertised port (`1024`–`65535`), accepting exactly one
   `Authorization: Bearer <pairing>` header and returning:

   ```json
   {
     "printers": [
       {
         "serial": "01P00A000000000",
         "host": "192.168.1.50",
         "access_code": "12345678",
         "name": "Workshop P1P"
       }
     ]
   }
   ```

   A bare JSON list works too. `name` is optional; the other three are required
   and a printer missing any of them is skipped rather than half-imported.

   Missing, duplicate, or incorrect authorisation is rejected without invoking
   the printer-data supplier. The authorized success payload necessarily carries
   the access code to Home Assistant; rejection/error responses and logs must
   never expose the pairing token or an access code.

   Home Assistant accepts only a numeric LAN address advertised by zeroconf:
   RFC 1918 or shared IPv4 address space, or IPv6 unique-local space. Public,
   loopback, link-local, hostname, URL-like, scoped-IPv6, and privileged-port
   targets are rejected before a client session is opened. This keeps a hostile
   advertisement from turning discovery into a general SSRF request. It also
   matches Home Assistant 2025.1.4, whose `ZeroconfServiceInfo.host` is the
   string form of its selected non-link-local IP address rather than the
   advertised `.local` hostname.

   Redirects are never followed, so the pairing credential cannot be replayed
   to a `Location` target. Transparent decompression is disabled and encoded
   responses are rejected, preventing a compression bomb from expanding before
   application limits run. The identity-encoded response is streamed through a
   64 KiB limit before JSON parsing, so a lying or missing `Content-Length`
   cannot bypass the bound.

3. **Stop advertising and serving** when the sharing window closes, and send a
   zeroconf goodbye so Home Assistant can remove the stale offer promptly.

### Why the pairing token exists

It is *not* a Home Assistant credential and grants nothing inside Home
Assistant. Its job is to tie the HTTP fetch to the currently advertised sharing
window and reject blind or stale requests. The token itself is carried in the
zeroconf TXT record: another device that can observe the same LAN broadcast can
also see it, so it is **not** a confidentiality boundary against a hostile LAN
peer. Keep the network trusted, generate a fresh token for every window, keep
the window short, and stop serving as soon as it closes.

Home Assistant keeps the token only in the in-memory flow state long enough to
make the confirmed fetch. Discovery deduplication uses normalized host and port
only. The token, its prefix, and any digest of it must never enter the flow
unique ID, config-entry data, or this integration's logs and diagnostics.

This fork's own log messages never render the token or offer body. Be aware
that Home Assistant Core 2025.1.4 emits the complete zeroconf discovery object,
including TXT properties, when the
`homeassistant.components.zeroconf` logger is explicitly set to `debug`.
Do not enable or share that raw upstream diagnostic while a sharing window is
open. Turning sharing off immediately makes the per-window credential unusable;
preventing Core's pre-flow debug record itself requires an upstream redaction
change rather than code inside this integration.

### Treating the offer as untrusted

The payload comes from another program, so this fork bounds it: at most
32 printers and at most 256 characters per field. Fields must be JSON strings;
oversized fields are rejected instead of truncated (especially credentials),
whitespace is stripped, non-objects are skipped, and a printer missing any
required field is dropped. Printer targets must pass the same numeric-LAN
address policy as the slicer endpoint, preventing the confirmed import from
being used as a second-hop SSRF request.

Invalid records, duplicate normalized serials, and records beyond the
32-printer inspection cap are counted as rejected. If at least one valid
printer remains, Home Assistant preserves those valid printers and includes
the rejected count in the final aggregate instead of silently reporting every
offered record as imported. If no valid printer remains, the confirmation form
reports a bad offer and creates no child flows. Record contents and credentials
are never included in that count or its logs.

Authentication failures are reported as a rejected pairing credential.
Redirects and other non-success HTTP responses report a connection failure.
Malformed, recursively invalid, or oversized JSON reports a bad offer. None of
those paths logs the bearer value, response body, or printer access code.

---

## B. Service call — `bambu_lab.add_printer`

Use this when nobody is sitting in front of Home Assistant.

Home Assistant does **not** expose config-entry creation over the REST API.
Config flows run over the authenticated **WebSocket** API
(`config_entries/flow/*`), driven step by step, which is impractical to drive
from a desktop application. Services, however, *are* reachable over REST:

```
POST /api/services/bambu_lab/add_printer   ->   config flow "import" step   ->   config entry
```

| Field | Required | Notes |
| --- | --- | --- |
| `serial` | yes | Printer serial. Case-insensitive; normalised to upper case. Must be 1–64 letters, numbers, underscores, or hyphens so it stays a literal MQTT topic segment and cache-directory name. |
| `host` | yes | LAN IP or hostname of the printer. |
| `access_code` | yes | LAN access code from the printer's screen. |
| `name` | no | Friendly name. Defaults to `<device_type>-<serial>`. |
| `print_cache_count` | no | Default `100`. |
| `timelapse_cache_count` | no | Default `1`. |
| `usage_hours` | no | Default `0`. |
| `disable_ssl_verify` | no | Default `false`. |
| `enable_firmware_update` | no | Default `false`. |

```bash
curl -X POST "http://homeassistant.local:8123/api/services/bambu_lab/add_printer" \
  -H "Authorization: Bearer $HA_LONG_LIVED_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"serial":"01P00A000000000","host":"192.168.1.50","access_code":"12345678"}'
```

### Enabling the service before you have any printers

The upstream integration registers its services inside `async_setup_entry`, so
they only exist once a printer is configured — useless for adding your *first*
one. This fork registers `add_printer` at component level instead.

For the cold-start case (integration installed, zero printers configured), add
this to `configuration.yaml` so Home Assistant loads the component:

```yaml
bambu_lab:
```

Once any printer exists the component loads on its own and the line is no longer
needed. Path A does not need this — a discovery card loads the integration by
itself.

---

## What neither path does

- **Neither skips verification.** The printer connection is tested before
  anything is written. A printer that does not answer is not added — unattended
  must not mean unchecked.
- **Neither creates duplicates.** A serial that is already configured is left
  alone, including entries created before this fork existed (those predate
  unique IDs, so the serial in the entry data is checked as well). Offer lists
  are deduplicated by normalized serial before child flows start, and Home
  Assistant's in-progress unique-ID guard prevents concurrent service or
  discovery imports from probing the same serial twice.
- **Neither persists a path or MQTT pattern as a serial.** Traversal fragments,
  separators, dots, `+`, `#`, control characters, and values longer than 64
  characters are rejected before logging, connecting, or writing an entry.
- **A rejected MQTT connection fails immediately.** A nonzero CONNACK is
  returned without subscribing or waiting out the ten-second connection
  timeout, so access denial stays distinct from a dead printer.
- **Bulk results stay factual.** A complete import, partial import, set of
  already-configured/in-progress printers, and failed verification are reported
  separately. The total also accounts for invalid, duplicate, and over-limit
  offer records as rejected. One success no longer hides a sibling failure or
  a dropped record, and connection failures are never mislabeled as already
  configured.
- **Neither does cloud mode.** LAN mode only. Cloud sign-in is interactive by
  nature (e-mail codes, 2FA) and does not belong in an unattended path.
- **Neither logs the access code.**

## Security notes

- The printer **access code is a credential**. Both paths move it from the
  slicer into Home Assistant. Serve path A only while sharing is on and only on
  a network you trust. For path B, the Bambu Studio companion accepts HTTPS for
  remote Home Assistant instances and plain HTTP only for exact loopback
  destinations; it refuses to send a Home Assistant bearer token over remote
  cleartext HTTP. Keep both credentials out of shell history and logs.
- The long-lived token in path B grants broad access to Home Assistant. Treat it
  like a password. Path A exists precisely so you do not have to create one.

## Verification

See [`verification.md`](app-doc://article/ha-bambulab.repository.90d52690bcd71f46) for what was actually run, against
which Home Assistant, what it proved, and which checks are still pending.
