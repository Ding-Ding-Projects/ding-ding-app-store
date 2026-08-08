# `src/main/java/config/ServerHandler.java`

**Java** · 28 lines · 1,100 bytes · 1 commit(s) · first 2021-02-15 · last 2021-02-15

## Purpose

Handler for the server argument, informs the GUI whether the -s argument was passed or not. We can't look at the value of -s alone because reading previously stored config data will otherwise cause the settings GUI to be skipped when loading from the config file, even if it should be shown.

## Commit history

| Date | Commit | Author | Summary |
| --- | --- | --- | --- |
| 2021-02-15 | `18f7b45` | Mirco Kroon | Reload previous settings from file |

← file-history index
