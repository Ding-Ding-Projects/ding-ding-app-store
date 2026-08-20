# `src/main/java/packets/DataReader.java`

**Java** · 245 lines · 8,856 bytes · 28 commit(s) · first 2019-05-08 · last 2026-05-29

## Purpose

This class takes care of reading in bytes from the network steam and turning it into individual packets.

## Commit history

| Date | Commit | Author | Summary |
| --- | --- | --- | --- |
| 2026-05-29 | `6875226` | cafepromenade | Prevent proxy thread from dying on Throwable (fixes client timeout) |
| 2021-02-17 | `b22a9f4` | Mirco Kroon | Fixed concurrency issues |
| 2021-02-13 | `352e0c2` | Mirco Kroon | Redirect console output when not run from a terminal |
| 2021-02-01 | `11f0706` | Mirco Kroon | Split Game class into ConnectionManager and Config |
| 2021-02-01 | `f7b4e8b` | Mirco Kroon | Added tests for packet building/parsing |
| 2021-02-01 | `4136b3c` | Mirco Kroon | Rename PacketBuilder, created actual PacketBuilder |
| 2019-12-09 | `e495385` | Unknown | Changed encryption to correct scheme without padding to reduce latency |
| 2019-12-05 | `c021463` | Unknown | Changed LinkedList to ByteQueue to reduce memory overhead |
| 2019-12-04 | `2b1de6b` | Unknown | Added thread priority for proxy |
| 2019-05-12 | `296521e` | Unknown | print exceptions when packet builder fails |
| 2019-05-12 | `8f4dc62` | Unknown | documentation and refactoring |
| 2019-05-12 | `087ca98` | Unknown | masked host in handshake package to prevent nosy servers from kicking |
| 2019-05-11 | `dc8c812` | Unknown | clean-up of prints, proper connection reset on disconnect |
| 2019-05-11 | `071399e` | Unknown | fixed crashes on not-yet-complete packet size |
| 2019-05-10 | `b3f1383` | Unknown | clean up, added coordinate parsing and printing |
| 2019-05-10 | `ec87198` | Unknown | split encryptor/decryptor into client and server |
| 2019-05-10 | `b459080` | Unknown | fixed issues with compression |
| 2019-05-10 | `5459d9a` | Unknown | added compression manager |
| 2019-05-10 | `f4680b5` | Unknown | added compression limit case |
| 2019-05-10 | `b54938e` | Unknown | fixed chunking, changed encryption method to update |
| 2019-05-10 | `ad6f05e` | Unknown | fixed missing packet identifier |
| 2019-05-10 | `e381cb2` | Unknown | set up encryption/decryption of all data |
| 2019-05-10 | `3361dab` | Unknown | succesful token verification |
| 2019-05-09 | `d2d0ae2` | Unknown | Added reading of encryption related packages |
| 2019-05-09 | `fcae8b2` | Unknown | converted to regular queue & moved packed reading to before send |
| 2019-05-09 | `ff44a1e` | Unknown | fixed issue |
| 2019-05-08 | `ab38b5d` | Mirco Kroon | Make application work with mode switching and various packet builders |
| 2019-05-08 | `300d52d` | Mirco Kroon | Added basic packet handling set up |

← file-history index
