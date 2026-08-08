---
id: notifications-and-status
title: Notifications and operation status
titleYue: 通知同操作狀態
category: experience
status: limited
summary: Stacks corner snackbars, retains searchable notification history, and keeps destructive decisions behind native super-confirmation.
---
# Notifications and operation status

## Behaviour

Catalog, persistence, appearance, workspace, schedule, and operation results surface through a bottom-corner snackbar stack. Success and informational notices auto-dismiss after five seconds; errors persist until dismissed. Undo-capable operations attach an action. Every notice is also retained in the profile's bounded notification history, including its creation time and dismissed state. The App Store updater keeps its separate persistent banner so a restart decision is never lost to a short toast.

The title-bar bell opens a non-blocking notification centre. Its own search field carries the adjacent full regex builder. Status filters compose with text search, and selection supports visible-scope select-all, inversion, clear, bulk dismiss, JSON export, and bulk delete. Delete states the exact review count and requires both independent keys plus the full confirmation slider.

Install, Reinstall, and source installation are immediate one-click actions and never open a phrase-entry or second-confirmation dialog. Release installs publish a typed progress event to the initiating app card: downloading reports bounded byte progress and offers **Cancel install** until external installer launch; extraction stays cancellable until replacement; the portable commit phase is visibly locked before directory replacement; the executable launching phase stays cancellable until a successful child spawn; and installer-running is visibly locked and says why cancellation is unavailable. The renderer rehydrates active operation status after reload and ignores delayed events from an older operation UUID. An unproven process-tree termination becomes an explicit unknown/locked status rather than a guessed success or cancellation. Only destructive uninstall authorization uses the native two-key plus full-slider gate; informational errors and ordinary progress remain non-blocking notifications.

## Configuration

Quiet hours hold scheduler-generated corner notifications only; checks continue and the banner remains visible. Appearance tokens can style the notification and banner within the safe registry. Notification history is local to the current app profile and bounded to 250 records.

## Failure modes

A thrown renderer-side action produces the actual error message where caught. Update failures remain in failed updater state. Schedule failures keep their main-process message and backoff. Malformed persisted notification data is ignored rather than trusted. There is no generic retry action for every error. Bulk uninstall reports item progress but cannot provide a real byte stream from an installer that does not expose one.

## Security considerations

Notices display bounded application-owned messages and never intentionally include tokens, raw imports, release bytes, or private filesystem paths. Main-process validation happens before a success notice. Persisted records deliberately omit executable undo callbacks. Appearance cannot hide the destructive confirmation gate or window controls.

## Verification

Focused tests cover bounded persistence parsing, stack/centre wiring, adjacent regex search, bulk selection, super-confirmed deletion, filtered export, and typed installer progress/cancellation contracts. Strict renderer typechecking and the production renderer build pass. Packaged hidden-desktop keyboard, screen-reader announcement timing, and real third-party installer progress remain runtime evidence gaps, so status remains limited.

## Suggested articles

- [Activity history and export](../installed/activity-history.md)
- [App Store self-updater](../updates/app-store-self-updater.md)
- [Update schedule](../updates/update-schedule.md)
