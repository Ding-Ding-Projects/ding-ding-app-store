---
id: notifications-and-status
title: Notifications and operation status
titleYue: 通知同操作狀態
category: experience
status: limited
summary: Uses corner toasts and a persistent updater banner for non-decision state while keeping install/removal decisions in native dialogs.
---
# Notifications and operation status

## Behaviour

Catalog, persistence, appearance, workspace, schedule, and operation results surface through a bottom-corner snackbar. Success and informational notices auto-dismiss; error state remains available long enough to act on. Undo-capable operations attach an action. The App Store updater uses a separate persistent banner for available, downloading, ready, and failed states so a restart decision is never lost to a short toast.

Install/build confirmation and destructive uninstall authorization use the native in-app dialog because they require a user decision. Informational errors and ordinary progress do not open a blocking system dialog.

## Configuration

Quiet hours hold scheduler-generated corner notifications only; checks continue and the banner remains visible. Appearance tokens can style the notification and banner within the safe registry. This revision has one current toast slot rather than a stacked notification center/history with bulk actions, so a new notice may replace the prior one.

## Failure modes

A thrown renderer-side action produces the actual error message where caught. Update failures remain in failed updater state. Schedule failures keep their main-process message and backoff. There is no generic retry action for every error and no persistent notification center yet. A busy install dialog currently shows `Working…` but not a real byte/process progress stream.

## Security considerations

Notices display bounded application-owned messages and never intentionally include tokens, raw imports, release bytes, or private filesystem paths. Main-process validation happens before a success notice. Appearance cannot hide the destructive confirmation gate or window controls.

## Verification

Source inspection proves the corner snackbar, updater banner, undo action, quiet-hour holding, and separation from decision dialogs. Contract checks cover the update state shapes. Stacking, notification history, assistive announcement timing, cancellation, and real install progress require additional implementation and runtime tests, so status is limited.

## Suggested articles

- [Activity history and export](../installed/activity-history.md)
- [App Store self-updater](../updates/app-store-self-updater.md)
- [Update schedule](../updates/update-schedule.md)
