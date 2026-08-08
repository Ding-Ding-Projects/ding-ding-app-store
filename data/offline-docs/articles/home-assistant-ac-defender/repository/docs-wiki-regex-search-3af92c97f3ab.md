---
layout: doc
title: "Regex search builder"
---

# Regex search builder

The command palette, Defense roster, and Field Manual each keep their search field beside a
full anchored regex builder. Plain text is still the default: entering words uses the existing
space-separated AND search over the visible labels and descriptions. Choosing **Regular
expression** deliberately switches that one field to the bounded .NET engine.

## Behaviour and configuration

The builder exposes a raw pattern, `i`/`m`/`s` flags, sample text, guided snippets for literals,
character classes, anchors, groups, alternation, and quantifiers, plus local validation and copy.
Patterns are limited to 512 characters. Candidate labels are capped at 16,384 characters and
each regex evaluation has a 100 ms timeout. The same matcher powers all three surfaces, so a
pattern cannot silently mean something different in the palette, roster, or manual.

## Failure modes and security

An empty query shows the complete local list. Invalid, oversized, or timed-out regexes produce no
matches and keep the search field editable; they never call Home Assistant and never change a
defender setting. Search text, patterns, sample text, and flags stay in the Blazor circuit only:
they are not sent to an external service, written to the settings repository, or included in
thermostat commands. The timeout and input bounds protect the UI circuit from catastrophic
backtracking while preserving the real live evidence shown by each guard.

## Verification

`RegexSearchMatcherTests` proves plain-text AND semantics, case-insensitive flags, invalid and
oversized-pattern rejection, and bounded adversarial input. Run:

```text
dotnet build
dotnet run --project HomeAssistantAcDefender.Tests/HomeAssistantAcDefender.Tests.csproj
```

In a signed-in browser, open **Command palette**, **Defense**, and **Guide**, expand each adjacent
builder, choose regex mode, enter a valid pattern, then enter `[` to confirm the inline invalid
state and no-match result. At 390px wide the builder's grid collapses to one column without
horizontal overflow.

## Suggested articles

- Command palette — keyboard navigation and exact destinations
- App tabs — four independent tab searches and bulk-close previews
- Settings history filters — date, action, and regex filters

## Failure modes

If **Regex search builder** cannot obtain one of its required real inputs, it reports a blocked, held, or unavailable result and leaves the background worker's Home Assistant refresh running. It never fills a missing room reading, audit event, weather sample, usage value, or device state with a simulator value. If a real Home Assistant command is rejected, the user sees the service's actual error and the article's surface remains available for recovery.
## Security considerations

This feature consumes only the configured Home Assistant entity data, local settings, and the audit context named above. Tokens and credentials stay in the server environment; the static documentation site does not collect analytics, transmit search text, or embed third-party assets. Logs and exports should be reviewed before sharing because real entity names and timestamps can identify a household.
