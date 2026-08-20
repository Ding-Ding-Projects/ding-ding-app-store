# Identity and workspace features

This category covers account selection and fast navigation when one Desktop
Material installation manages many identities, repositories, and branches.

## Features

- [Multiple accounts, rich account picker, and repository
  identity](multiple-accounts-and-repository-identity.md)
- [Repository sidebar and
  pinning](repository-sidebar-and-pinning.md)
- [Branch switcher workflows](app-doc://article/desktop-material.repository.7a3a275662f542fe) — branch discovery,
  dirty-worktree switching, and the **Not updated with main** merge filter
- [Owner-scoped appearance and
  history](owner-scoped-appearance-and-history.md)
- [Tab-strip settings commit
  chip](tab-strip-settings-commit-chip.md)
- [Settings search](app-doc://article/desktop-material.repository.ac030f2c405e3d33)
- [Settings tab docking](app-doc://article/desktop-material.repository.71a7d2433aa53088)
- [Scheduled language, appearance, and external
  settings](scheduled-settings.md)
- [Collection bulk actions and regex
  safety](collection-bulk-and-regex-safety.md)
- [Tab groups](app-doc://article/desktop-material.repository.a9ee5c3d57e6d077)
- [Tab-strip overflow dropdown](app-doc://article/desktop-material.repository.0e2a4fe18c0273a8)
- [Browser-style settings tabs](app-doc://article/desktop-material.repository.fc18cdc6bfe1caab)

High-frequency visual edits are coalesced before persistence, while remote
default-branch lookup reuses only a namespace-validated local symbolic ref.
The cross-cutting lifecycle contract is documented under
[Quality and reliability](app-doc://article/desktop-material.repository.d123003c7eccf984).

## API applicability

Account-bound provider calls use the application's existing GitHub, GitLab,
and Bitbucket clients. These features add no standalone HTTP endpoint, so a
Postman collection is not applicable.
