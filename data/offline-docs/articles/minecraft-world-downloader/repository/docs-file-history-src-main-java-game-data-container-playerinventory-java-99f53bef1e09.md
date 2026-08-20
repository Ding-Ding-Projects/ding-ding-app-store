# `src/main/java/game/data/container/PlayerInventory.java`

**Java** · 112 lines · 4,027 bytes · 1 commit(s) · first 2026-06-04 · last 2026-06-04

## Purpose

Holds the contents of the player's own inventory (container window 0) so they can be written into level.dat under Data.Player.Inventory when the world is saved. Contents are kept up to date from two packets: the full inventory sync ({@link #setSlots}) and single-slot updates ({@link #setSlot}). The slot indices used in the inventory window are not the same as the slot numbers Minecraft expects in level.dat, so {@link #toNbt()} maps between the two.

## Commit history

| Date | Commit | Author | Summary |
| --- | --- | --- | --- |
| 2026-06-04 | `72f3d1b` | cafepromenade | d |

← file-history index
