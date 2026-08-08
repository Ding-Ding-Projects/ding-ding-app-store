# Collaboration features

This category documents provider-backed workflows that let contributors review
and manage collaboration state without leaving Desktop Material.

## Features

- [Checkout branches from other forks](app-doc://article/desktop-material.repository.05badc56dd267ab3) — discover a
  bounded GitHub repository network, review an exact fork branch head and
  Desktop-managed ref, then fetch and checkout with stale-state guards.
- [Native pull request creation](app-doc://article/desktop-material.repository.671cabf14bdf4577) — discover bounded
  repository templates, review title/body/draft and provider-backed metadata,
  then create through the exact authenticated GitHub account and local head.
- [Native pull request review workspace](app-doc://article/desktop-material.repository.4bc1b237c93ce928) —
  inspect a bounded, exact-head pull request workspace with a fixed summary and
  right rail; review files, commits, conversation, and checks; queue inline
  comments, safe fenced replacement suggestions, and replies; submit a review;
  and close, reopen, or merge with explicit confirmation.
- [Rich pull-request context and
  actions](pull-request-context-and-actions.md) — keep exact head/base context,
  metadata, checks, timelines, and guarded lifecycle actions in one workspace.
- [Pull-request activity
  notifications](pull-request-activity-notifications.md) — route relevant
  reviews, comments, and failed checks through de-duplicated OS notifications.
- [Offline GitHub Projects workspace](app-doc://article/desktop-material.repository.7bd8362b0d0945f6) — inspect a
  bounded read-only Projects v2 snapshot, with a capability-aware classic
  fallback and a sanitized per-repository cache for offline recovery.

## API applicability

The workspace consumes authenticated GitHub REST endpoints through the existing
account-bound client. It does not expose an application HTTP endpoint, so a
Postman collection is not applicable. The provider routes and payload limits
are documented with the feature instead.
