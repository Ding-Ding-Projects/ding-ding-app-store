# Verification

What was actually run for this fork's changes, against what, and what it proved.
Verified results and pending work are separated explicitly; a pending item is
never presented as an executed result.

## Environments

- The historical live REST exercise used a **throwaway Ubuntu 24.04 WSL
  container**, created and destroyed for the purpose, with Home Assistant
  **2025.1.4** in a clean virtualenv.
- The historical unit snapshot ran on **2026-07-28** in the official
  `ghcr.io/home-assistant/home-assistant:2025.1.4` x86_64 image. The exact
  source snapshot was mounted read-only, the container root was read-only,
  `/tmp` was ephemeral, no ports were published, and the container was limited
  to 2 CPUs, 3 GiB of memory and 512 processes. The source archive SHA-256 was
  `10e2a876d0d7123f5c52450b12963b226ff1054f791db0d157fbe3321d0b2809`.
  Runtime assertions confirmed Home Assistant **2025.1.4**, pytest **8.3.4**,
  and `pytest-homeassistant-custom-component` **0.13.196** without allowing that
  plugin's dependency metadata to replace Core with 2025.1.0b2. That fixture
  build was generated from 2025.1.0b2, so this result is retained as historical
  evidence rather than presented as the current clean recipe.
  A second historical clean-runner reproduction used `python:3.12-bookworm`
  (Python 3.12.13), installed the then-current 0.13.196 recipe, and produced the
  same green test count under the same CPU, memory, PID, read-only-source and
  no-port boundaries. The current §5 recipe instead pins
  `pytest-homeassistant-custom-component==0.13.205`, whose metadata matches Home
  Assistant 2025.1.4, and installs everything with one
  `pip install -r requirements-test.txt`. Its clean functional suite passes
  93/93, including the targeted oversized-integer bad-payload regression at
  1/1 and the new serial/MQTT rejection group at 3/3. The normal Windows
  invocation is blocked before test execution by the
  plugin's `pytest-socket` AF_INET socketpair incompatibility. An in-memory
  harness using a Selector loop and a no-op plugin socket-disable hook—with no
  repository edits—yielded the clean local 93/93 result. The canonical
  unmodified Ubuntu workflow independently passed 93/93 in 3.36 seconds at
  [run 30359258358](https://github.com/Ding-Ding-Projects/ha-bambulab/actions/runs/30359258358).

## 1. Live REST against a running Home Assistant

The service path (B) driven end to end through HTTP, against a real running
instance rather than a test harness:

```
[1] bambu_lab services visible over REST: ['add_printer']
    add_printer present with ZERO printers configured: True
[2] missing required fields -> http 400
[3] unreachable printer (192.0.2.1) -> http 500, failed loudly
[4] bambu entities created by the failed add: 0
[5] log shows the flow verified the printer and aborted: True
=> ALL PASS
```

`192.0.2.1` is TEST-NET-1, guaranteed unroutable, so the failure is real rather
than simulated. The log confirms the reason instead of it being inferred from a
status code:

```
add_printer: requested for serial '01P00A000000000'
async_step_import: importing serial '01P00A000000000' at '192.0.2.1'
async_step_import: could not connect to '01P00A000000000' at '192.0.2.1'
HomeAssistantError: Could not add printer '01P00A000000000': cannot_connect
```

**What this proves:** a plain REST call reaches the config flow, which REST
cannot otherwise do; the service exists before any printer does; and a printer
that does not answer is verified and refused rather than written.

## 2. Historical unit snapshot

The preserved snapshot collected **89 tests** and reported:

```text
89 passed in 2.63s
```

**`tests/test_add_printer.py` (11)** — the import step with the printer mocked,
so the *success* path is covered too: entry creation and its exact data/options
shape, serial upper-casing, `force_ip` when the host differs from the printer's
own IP, optional-field passthrough, every missing-field case, unreachable
printers, duplicate serials, idempotency, and a real Home Assistant
config-flow-manager regression proving a concurrent same-serial import aborts
as already in progress before it opens a second client or probe.

**`tests/test_slicer_pairing.py` (78)** — endpoint identity helpers, LAN-only
endpoint policy, authenticated and bounded offer fetching, hostile payload
handling, duplicate-serial normalization, bounded import concurrency, aggregate
outcomes including rejected records, translation-key uniqueness, executor
isolation, the first-result-only queue helper, a real flow-manager zeroconf
identity regression, and the real nested BambuClient/Paho callbacks driven
through a fake MQTT client.

The earlier `25 passed` and `87 passed` results remain historical evidence only.
The 89-test run is likewise a preserved snapshot, not a claim about the current
tree after switching to the matching 0.13.205 fixture package.

### Current fixture-matched functional suite

The current dependency set pins Home Assistant **2025.1.4** and
`pytest-homeassistant-custom-component` **0.13.205**. The full functional suite
reported:

```text
93 passed
```

The newly added oversized-integer bad-payload regression was also isolated and
reported:

```text
1 passed
```

The 1/1 and 3/3 focused results are part of the 93/93 suite, not extra tests. A normal
Windows invocation cannot reach test execution because the fixture plugin's
`pytest-socket` hook rejects the AF_INET socketpair used on that platform. The
verified local run used an in-memory harness—a Selector loop plus a no-op plugin
socket-disable hook—and made no repository edits. The canonical unmodified
Ubuntu commands in §5 subsequently passed 93/93 in 3.36 seconds at
[run 30359258358](https://github.com/Ding-Ding-Projects/ha-bambulab/actions/runs/30359258358).

## 3. Companion verification

The matching Bambu Studio implementation for
[BambuStudio#16](https://github.com/Ding-Ding-Projects/BambuStudio/issues/16)
includes the sharing toggle, fresh per-window pairing credential, authenticated
bounded HTTP offer, zeroconf advertisement, and shutdown/goodbye behavior.

Completed on 2026-07-28:

- The focused `home_assistant_tests` and `home_assistant_sharing_probe` targets
  compiled successfully.
- The focused CTest selection passed **5/5**.
- The native suite passed **30 cases with 267 assertions**, including a
  four-wide Path B bound (at most eight 30-second waves for 32 printers) and
  cleanup of the temporary recovery scene when a light-alert transaction is
  cancelled.
- The full Bambu Studio Release GUI build passed. The final corrected DLL
  SHA-256 is
  `41BB1BFC754E3184C5908E2145A93E3640D3866E59380F32EEFF7A76F418E972`.
  The DLL is 151,299,584 bytes and was written at
  `2026-07-28 08:15:46 -04:00`. The final relinking build took 214.808 seconds;
  the subsequent no-change build completed in 8.544 seconds.
- Real Lowlevel headless English captures were reviewed at **720×760** and
  **520×480**. The first pass exposed a text-action shrink/clipping defect; the
  defect was fixed, the GUI was rebuilt, and both sizes were recaptured from the
  corrected build.
- The static localization/clipping checks passed **21/21**, and the browser
  responsive matrix passed **156/156**.
- A production-service cross-host probe observed the complete PTR/SRV/TXT/A
  advertisement from a second same-LAN host, completed the authenticated
  bounded printer-offer fetch, and observed the zero-TTL goodbye after service
  shutdown.
- The current parser/import regressions reject traversal, separators, dots,
  MQTT `+`/`#` wildcards, and oversized serials before connection or
  persistence. The nested Paho callback regression also proves a nonzero
  CONNACK returns immediately without subscribing or spending the ten-second
  timeout budget.

**What this proves:** the current companion sharing implementation compiles at
its service boundary and as the full Release GUI, enforces its tested bounds and
authentication, publishes the expected discovery records to another host,
serves the offer, withdraws the service, and renders its English Smart Home
surface at both reviewed native sizes after the clipping fix. It does not by
itself prove native bilingual rendering or Home Assistant's confirmation flow.

The following are still **pending**, not inferred:

- capture and review the native Bambu Studio surface in bilingual mode;
- complete the discovery card and authenticated offer fetch in a real Home
  Assistant 2025.1.4 instance;
- repeat the historical REST exercise against the current executor-backed
  transaction and global import limiter;
- verify the expected connection refusal for a controlled unused RFC 1918 or
  IPv6 ULA printer target without claiming that as a physical-printer success.
  A TEST-NET target is useful only for verifying pre-connection payload-policy
  refusal because it is intentionally outside the accepted LAN ranges.
- resolve the missing-license owner decision tracked in
  [fork issue #1](https://github.com/Ding-Ding-Projects/ha-bambulab/issues/1);
  code and package validation cannot authorize licensing terms.

## 4. What is NOT verified

Stated plainly rather than left to assumption:

- **No real printer was involved.** No Bambu Lab hardware is available here, so
  the success path is proven with `BambuClient` mocked. The earlier live REST
  exercise reached the connection attempt before the executor-backed
  transaction and import semaphore were introduced; those current paths are not
  live-verified until a new run records them.
- **The discovery path has not yet been completed by a real Home Assistant
  confirmation flow.** The production companion's cross-host advertisement,
  authenticated fetch, and goodbye are verified, and the integration source
  contains focused parsing and bounds regressions that pass in the current
  93/93 functional suite. Home Assistant reception, the visible confirmation
  card, and the resulting real child flows remain unproven until that evidence
  is added here.
- **Native bilingual capture has not yet been completed.** The full Release GUI
  build and corrected English Lowlevel captures at 720×760 and 520×480 are
  verified, and the browser matrix passes 156/156. Those results do not replace
  a real native capture of the longest bilingual strings.
- **Hosted and remote results remain a separate evidence stream.** Exact pushed
  revisions, CI verdicts, and release links are maintained in
  [Bambu Studio issue #16](https://github.com/Ding-Ding-Projects/BambuStudio/issues/16);
  local green results do not imply those outcomes.
- **The companion Wiki is enabled but uninitialized.** GitHub reports
  `hasWikiEnabled=true`, but
  `https://github.com/Ding-Ding-Projects/ha-bambulab.wiki.git` returns
  `Repository not found`. GitHub requires a signed-in user to create the first
  Wiki page before its Git repository can be cloned, and the available
  `gh`/REST interfaces do not expose Wiki-page creation. Wiki synchronization is
  blocked on that one-time UI action and is not claimed here.
- **CI ran red three times before this suite passed**, each time on a missing
  test-environment package rather than a code fault (`async_upnp_client`,
  `hass_frontend`, `haffmpeg`, `zeroconf` — component requirements a real Home
  Assistant fetches at runtime). That history explains the pinned clean recipe;
  the current 0.13.205 suite is now separately verified by hosted run
  `30359258358`.
- **HACS repository validation remains blocked on licensing metadata.** The
  fork and upstream both report no license, upstream's license endpoint is 404,
  and the HACS license check is not ignorable. No license was invented; owner
  authority is required in
  [fork issue #1](https://github.com/Ding-Ding-Projects/ha-bambulab/issues/1).

## 5. Reproducing

```bash
python -m pip install -r requirements-test.txt
python -c "from homeassistant.const import __version__; assert __version__ == '2025.1.4'"
python -c "from importlib.metadata import version; assert version('pytest-homeassistant-custom-component') == '0.13.205'"
pytest tests/test_slicer_pairing.py tests/test_add_printer.py -q
pytest tests -q
```

The commands above are the canonical unmodified Ubuntu/Linux reproduction.
Windows currently needs the no-edit in-memory harness described above because
the plugin's socket-disable hook and AF_INET socketpair conflict before test
execution. The current 93/93 result remains distinct from the historical 89/89
snapshot; hosted CI reported the same 93/93 result in 3.36 seconds.
