# `src/main/java/proxy/ProxyServer.java`

**Java** · 156 lines · 7,568 bytes · 22 commit(s) · first 2019-05-08 · last 2026-06-08

## Purpose

Proxy server class, handles receiving of data and forwarding it to the right places.

## Commit history

| Date | Commit | Author | Summary |
| --- | --- | --- | --- |
| 2026-06-08 | `b441a56` | cafepromenade | Log routine socket closes calmly (don't treat them as errors) |
| 2026-06-08 | `1016e4a` | cafepromenade | Use a plain hyphen in disconnect messages (avoid mojibake in non-UTF8 consoles) |
| 2026-06-07 | `60a2ff3` | cafepromenade | Show the reason on disconnect (debug); fix swapped client/server labels |
| 2026-05-29 | `6875226` | cafepromenade | Prevent proxy thread from dying on Throwable (fixes client timeout) |
| 2021-02-17 | `b22a9f4` | Mirco Kroon | Fixed concurrency issues |
| 2021-02-15 | `d782dda` | Mirco Kroon | Comments, small changes and fixes |
| 2021-02-01 | `11f0706` | Mirco Kroon | Split Game class into ConnectionManager and Config |
| 2020-10-08 | `bd9d3e5` | Mirco Kroon | Added handling of SRV records |
| 2019-12-14 | `7cbba15` | Unknown | Numerous improvements & bug fixes to GUI |
| 2019-12-04 | `2b1de6b` | Unknown | Added thread priority for proxy |
| 2019-05-12 | `8f4dc62` | Unknown | documentation and refactoring |
| 2019-05-11 | `da03eb5` | Unknown | added tile entity parsing |
| 2019-05-11 | `dc8c812` | Unknown | clean-up of prints, proper connection reset on disconnect |
| 2019-05-10 | `b3f1383` | Unknown | clean up, added coordinate parsing and printing |
| 2019-05-10 | `ec87198` | Unknown | split encryptor/decryptor into client and server |
| 2019-05-10 | `b54938e` | Unknown | fixed chunking, changed encryption method to update |
| 2019-05-10 | `e381cb2` | Unknown | set up encryption/decryption of all data |
| 2019-05-10 | `3361dab` | Unknown | succesful token verification |
| 2019-05-09 | `fcae8b2` | Unknown | converted to regular queue & moved packed reading to before send |
| 2019-05-09 | `ff44a1e` | Unknown | fixed issue |
| 2019-05-08 | `ab38b5d` | Mirco Kroon | Make application work with mode switching and various packet builders |
| 2019-05-08 | `300d52d` | Mirco Kroon | Added basic packet handling set up |

← file-history index
