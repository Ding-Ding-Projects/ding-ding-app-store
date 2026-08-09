---
id: status-hub
title: Shared Status Hub
titleYue: 共用 Status Hub
category: memory-sync
status: limited
summary: Documents the interactive status and handoff surface, its session boundaries, and the evidence limits of this App Store bundle.
---
# Shared Status Hub

## Behaviour

The shared Status Hub is the live handoff surface for agent sessions: each session has a status card, current evidence, next gates, and a bounded question channel. A question is accepted only when the authenticated service acknowledges it for the owning session; a static page or a button that cannot deliver an answer is not presented as interactive. The card distinguishes running, waiting, blocked, failed, and verified states without upgrading a pending workflow.

This App Store repository documents the Status Hub contract and mirrors its public feature articles into the offline browser. It does not claim that this packaged desktop app hosts the hub, injects answers into a chat, or observes an agent inbox without a real bridge. The live service, deployment, and visual capture remain separate evidence lanes.

## Configuration

The Status Hub session record is scoped to a bounded session identifier and cursor. Authentication, session limits, question size, answer size, and polling cadence are bounded by the service; cards expose only public status projections. A local fallback page may show copied evidence when no authenticated hub connector is available, but it must say that answers cannot reach the agent automatically.

## Failure modes

An unavailable service, rejected authentication, expired session, invalid cursor, unknown question, stale answer, provider outage, or unsupported bridge fails closed as a typed blocked or unavailable state. The UI preserves the last known evidence without pretending that a question was delivered. A missing screenshot capability or queued workflow is recorded as pending rather than green, and the offline App Store article remains readable.

## Security considerations

Status cards contain bounded evidence and never expose enrollment tokens, session secrets, private prompts, credentials, or raw inbox payloads. Question answers are accepted only by the owning authenticated session; public projections omit private text. The App Store renderer receives typed status data and cannot submit shell commands, invoke host agents, or alter another repository through this documentation route.

## Verification

The docs generator validates this article, its related links, the memory-sync category index, the static-site mirror, the wiki page, and the generated offline bundle. Focused documentation tests assert the Status Hub name, accepted-answer boundary, and no-direct-chat/runtime claim. These checks prove article and mirror completeness only; they do not prove a live service deployment, authenticated answer delivery, headless screenshot, or packaged desktop integration.

## Suggested articles

- [Shared convenience skills](./convenience-skills.md)
- [Offline documentation browser](../documentation/offline-documentation-browser.md)
- [Privacy and security](../security/privacy-and-security.md)
- [Verification and evidence](../verification/verification.md)
