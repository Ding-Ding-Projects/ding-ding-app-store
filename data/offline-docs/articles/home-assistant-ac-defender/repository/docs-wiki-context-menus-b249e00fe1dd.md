---
layout: doc
title: "Context menus and mobile tab editing"
---

# Context menus and mobile tab editing

Every signed-in AC Defender page now owns its context menu. Right-click a tab, group label,
control, card, navigation item, or page surface to open a Material Design menu beside that exact
target. Keyboard users can focus the same target and press `Shift+F10` (or the platform context-menu
key). Touch and pen users can press and hold an app tab for 620 ms.

The menu is not a browser imitation painted on top of the page. Its commands use the same Blazor
state that powers the visible tab strip: activating, pinning, grouping, and closing a tab therefore
retain the existing navigation and persistence rules.

## Behaviour and configuration

Each menu identifies the target by its accessible label, then shows only actions that target can
actually perform. Tabs offer activate, pin/unpin, group assignment, appearance editing, and close.
Group labels offer local group search, rename/removal, and group appearance editing. Other controls
and surfaces offer appearance editing, accessible-label copy, and same-site link opening when a
real link exists.

The search field filters only the currently visible menu actions. Plain text is the default; its
adjacent full regex builder uses the shared .NET engine, `i`/`m`/`s` flags, a 512-character pattern
limit, a 16,384-character candidate limit, and a 100 ms timeout. Menu queries are ephemeral and are
not written to settings history.

Keyboard shortcuts shown in the right-aligned shortcut column are registered shortcuts, not hints:

| Shortcut | Action |
| --- | --- |
| `Shift+F10` or Context Menu | Open the menu for the focused target |
| `Shift+Alt+A` | Open appearance editing for the focused target |
| `Alt+P` | Pin or unpin a focused app tab |
| `Enter` | Activate a focused app tab |

On narrow screens, the menu clamps its coordinates to an 8px viewport inset, caps its height, and
scrolls internally. It paints an opaque background, border, elevation, and shape so page text never
shows through. Mobile app tabs and pin buttons use 44px minimum targets.

## Safety and unsaved-work protection

The context menu never calls Home Assistant and cannot change `climate.dining_room`. It changes
browser presentation and navigation metadata only. An active tab cannot be closed from its menu;
pinned tabs must be unpinned first; and the command tab remains available as the navigation
fallback. Those checks run again when the command executes, rather than trusting a disabled button
that might have become stale.

A touch long press is cancelled when the pointer moves more than 12px, lifts, or receives a pointer
cancel event. A completed long press suppresses its following synthetic click, so editing a tab does
not accidentally navigate. Horizontal tab-strip scrolling remains available.

Appearance targeting stores only a local presentation descriptor (target kind, stable interface
identifier, and accessible label) before opening Settings. It contains no Home Assistant token,
account secret, thermostat state, or user-entered settings value. Opening links from the menu is
restricted to the current site origin.

## Failure modes

- If JavaScript interop is unavailable, links, buttons, the rail, tab keyboard navigation, and all
  thermostat controls remain usable; only the enhanced context menu is absent.
- Invalid or timed-out regex input shows no matching actions and leaves the query editable.
- Browser clipboard or pop-up refusal becomes a non-blocking notification; the source label or link
  remains visible for a normal manual action.
- A protected close request is rejected again at execution time and explained in a notification.
- Moving a touch pointer cancels the 620 ms timer instead of fighting horizontal scrolling.

## Verification

`AppContextMenuPolicyTests` covers pinned, active, and command-tab close protection; generic
appearance access; bounded plain/regex menu search; and the JavaScript/Razor/CSS integration
contract. Run:

```text
dotnet build
dotnet run --project HomeAssistantAcDefender.Tests/HomeAssistantAcDefender.Tests.csproj
```

Runtime proof uses the real signed-in application at desktop and 390 CSS pixels: open menus by
right-click, `Shift+F10`, and touch/pen long press; test edge placement, search, regex validation,
pinning, group assignment, Escape/outside dismissal, and confirm zero console errors plus no
horizontal overflow. No simulated thermostat state is needed.

## Suggested articles

- App tabs — persistent pinning, grouping, searches, and protected bulk close
- Appearance editor — the persisted target editor opened by menu actions
- Regex search builder — the bounded engine used inside every context menu
- Command palette — the global keyboard route to pages and settings
