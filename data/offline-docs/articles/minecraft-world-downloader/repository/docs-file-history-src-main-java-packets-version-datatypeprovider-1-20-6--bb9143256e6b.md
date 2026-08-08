# `src/main/java/packets/version/DataTypeProvider_1_20_6.java`

**Java** · 151 lines · 5,512 bytes · 2 commit(s) · first 2024-06-29 · last 2026-06-03

## Purpose

Slot/item reading for 1.20.6+ (including 26.1.x). Since 1.20.5 an item stack is no longer a single NBT tag but a list of "data components". The wire format is: itemCount: VarInt if itemCount &gt; 0: itemId: VarInt componentsToAdd: VarInt componentsToRemove: VarInt add[]: componentType (VarInt) + type-specific data (NO length prefix) remove[]: componentType (VarInt) Components have no length prefix, so to stay aligned every component must be consumed by its exact structure. We consume the common scalar/NBT/string components and the recursive item-list components (shulker container, bundle, cros

## Commit history

| Date | Commit | Author | Summary |
| --- | --- | --- | --- |
| 2026-06-03 | `b633907` | cafepromenade | Read 1.20.6+ item data components so containers save again |
| 2024-06-29 | `220d8fc` | Mirco Kroon | Support for most of 1.21 |

← file-history index
