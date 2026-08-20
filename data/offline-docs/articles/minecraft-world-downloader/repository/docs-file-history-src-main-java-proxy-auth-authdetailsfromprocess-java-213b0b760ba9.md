# `src/main/java/proxy/auth/AuthDetailsFromProcess.java`

**Java** · 153 lines · 5,491 bytes · 7 commit(s) · first 2021-07-17 · last 2022-06-05

## Purpose

Retrieve authentication details from the Minecraft process. When Minecraft is launched, the launcher passes the username, user ID and access token to the process as arguments. We can retrieve these to use for authentication, as long as the game is already running.

## Commit history

| Date | Commit | Author | Summary |
| --- | --- | --- | --- |
| 2022-06-05 | `1ee16cf` | Mirco Kroon | Improved authentication GUI and method handling |
| 2021-11-20 | `2d9c3b8` | Mirco Kroon | Retrieve arguments using powershell on Windows |
| 2021-09-23 | `0d9c27f` | Mirco Kroon | Check for both javaw and java on Windows |
| 2021-08-24 | `edd74f7` | mygizli04 | Remove unnecessary method |
| 2021-08-24 | `d6adb3b` | mygizli04 | Fix macOS support |
| 2021-08-20 | `652942d` | Mirco Kroon | Simplified auth token code for Linux |
| 2021-07-17 | `7f2357e` | Mirco Kroon | Retrieve auth details from game process instead of launcher file |

← file-history index
