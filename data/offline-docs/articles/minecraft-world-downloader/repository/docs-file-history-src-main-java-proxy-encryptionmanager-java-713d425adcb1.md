# `src/main/java/proxy/EncryptionManager.java`

**Java** · 530 lines · 20,710 bytes · 49 commit(s) · first 2019-05-10 · last 2026-06-08

## Purpose

_No leading comment/docstring found — see the file and its history below._

## Commit history

| Date | Commit | Author | Summary |
| --- | --- | --- | --- |
| 2026-06-08 | `dcbe508` | cafepromenade | Explain online-mode auth failures instead of a silent disconnect |
| 2026-06-05 | `d1bb27a` | cafepromenade | Add opt-in, spectator-gated auto-open of nearby containers (#8) |
| 2024-05-17 | `7cad7ea` | Mirco Kroon | Initial support for 1.20.6 |
| 2023-03-11 | `8759183` | Mirco Kroon | Updated renderDistanceExtender to use circles |
| 2023-02-28 | `6699d2d` | Mirco Kroon | Removed support for protocol version 760 (1.19 to 19.2) |
| 2023-02-26 | `e9390a5` | Logan Bell | Add support for 1.19.3 |
| 2022-06-16 | `026b45d` | Mirco Kroon | Comments |
| 2022-06-16 | `a6c9b92` | Mirco Kroon | Removed bouncycastle dependency |
| 2022-06-14 | `4a95e3c` | Mirco Kroon | Correctly handle respawns & status messages, improved auth performance |
| 2022-06-13 | `d8dd512` | Mirco Kroon | Updated login sequence for 1.19 |
| 2021-03-18 | `9035f2e` | Mirco Kroon | Comments, refactoring and reformatting |
| 2021-03-09 | `8cf1f9d` | Mirco Kroon | Send lighting data for chunks |
| 2021-02-17 | `b22a9f4` | Mirco Kroon | Fixed concurrency issues |
| 2021-02-14 | `c2fb5bc` | Mirco Kroon | Improved authentication handling, removed interactive aspect |
| 2021-02-13 | `7916805` | Mirco Kroon | Refactored program arguments, switched UI to JavaFX |
| 2021-02-08 | `fa35486` | Mirco Kroon | Cleaned up prints |
| 2021-02-07 | `5455bd4` | Mirco Kroon | Chunk extending for 1.15 |
| 2021-02-06 | `0c08b78` | Mirco Kroon | Chunk extending for 1.13 |
| 2021-02-06 | `7136837` | Mirco Kroon | Invalidate extended chunks on dimension change |
| 2021-02-04 | `7f931b2` | Mirco Kroon | Complete render-distance extending for 1.16 |
| 2021-02-04 | `f2c4d75` | Mirco Kroon | Computed which chunks to send to the client for chunk extending |
| 2021-02-02 | `abc6aea` | Mirco Kroon | Instanced WorldManager, initial chunk network encoding |
| 2021-02-01 | `c84a342` | Mirco Kroon | Allow packets to be injected by the downloader |
| 2021-02-01 | `11f0706` | Mirco Kroon | Split Game class into ConnectionManager and Config |
| 2021-02-01 | `4136b3c` | Mirco Kroon | Rename PacketBuilder, created actual PacketBuilder |
| 2021-01-30 | `4110c70` | Mirco Kroon | Initiate ClientAuthenticator later for more recent auth details |
| 2020-07-11 | `36ab39a` | Mirco Kroon | Added manual authentication |
| 2020-04-04 | `2aa1df4` | Unknown | Added missing stacktrace printing |
| 2020-03-06 | `5497d4b` | Unknown | Support for modified Forge handshake |
| 2019-12-09 | `446c370` | Unknown | clean up |
| 2019-12-09 | `e495385` | Unknown | Changed encryption to correct scheme without padding to reduce latency |
| 2019-12-05 | `b0e6764` | Unknown | Use arrayCopy instead of loop |
| 2019-12-05 | `c021463` | Unknown | Changed LinkedList to ByteQueue to reduce memory overhead |
| 2019-05-18 | `3d83221` | Unknown | implemented handling for packets of different Minecraft versions |
| 2019-05-14 | `1ae5c48` | Unknown | added launch option for alternative minecraft locations (psycho support) |
| 2019-05-12 | `7a966d0` | Unknown | server-side authentication to prevent unauthorized access |
| 2019-05-12 | `d1c03fc` | Unknown | Prevent empty chunks from overwriting full ones |
| 2019-05-12 | `8f4dc62` | Unknown | documentation and refactoring |
| 2019-05-12 | `c057c7b` | Unknown | implemented argument parsing |
| 2019-05-12 | `087ca98` | Unknown | masked host in handshake package to prevent nosy servers from kicking |
| 2019-05-11 | `dc8c812` | Unknown | clean-up of prints, proper connection reset on disconnect |
| 2019-05-10 | `ec87198` | Unknown | split encryptor/decryptor into client and server |
| 2019-05-10 | `5459d9a` | Unknown | added compression manager |
| 2019-05-10 | `f4680b5` | Unknown | added compression limit case |
| 2019-05-10 | `b54938e` | Unknown | fixed chunking, changed encryption method to update |
| 2019-05-10 | `ad6f05e` | Unknown | fixed missing packet identifier |
| 2019-05-10 | `e381cb2` | Unknown | set up encryption/decryption of all data |
| 2019-05-10 | `4e894b8` | Unknown | added client authentication |
| 2019-05-10 | `3361dab` | Unknown | succesful token verification |

← file-history index
