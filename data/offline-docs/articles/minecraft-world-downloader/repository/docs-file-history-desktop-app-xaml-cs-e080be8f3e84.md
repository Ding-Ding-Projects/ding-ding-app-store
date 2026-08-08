# `desktop/App.xaml.cs`

**C#** · 50 lines · 1,787 bytes · 3 commit(s) · first 2026-06-01 · last 2026-06-07

## Purpose

Surface and log any crash instead of the window silently vanishing, and keep the app alive through non-fatal UI errors (e.g. a bad theme/render action) rather than terminating.

## Commit history

| Date | Commit | Author | Summary |
| --- | --- | --- | --- |
| 2026-06-07 | `cdaba37` | cafepromenade | Desktop GUI: global crash handler + hardened startup |
| 2026-06-01 | `707693f` | cafepromenade | Desktop: switch manager from WinUI 3 to WPF (reliable build) |
| 2026-06-01 | `2122f46` | cafepromenade | Add animated Material console redesign, WinUI 3 manager, NSIS installer, CI |

← file-history index
