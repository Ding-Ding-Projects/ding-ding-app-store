# `src/main/java/gui/images/RegionImage.java`

**Java** · 264 lines · 8,759 bytes · 8 commit(s) · first 2023-08-21 · last 2024-05-06

## Purpose

since all resizing happens on the same thread, we can re-use buffered image objects to reduce memory usage

## Commit history

| Date | Commit | Author | Summary |
| --- | --- | --- | --- |
| 2024-05-06 | `b5e6e63` | Mirco Kroon | Minor overview image issues |
| 2024-05-03 | `5d3689e` | Mirco Kroon | Fixed concurrency issue with chunk images |
| 2023-08-27 | `4931191` | Mirco Kroon | Only draw chunk images on the chunk image thread |
| 2023-08-25 | `e87a954` | Mirco Kroon | Debugging highlight of chunks/regions |
| 2023-08-23 | `a83786f` | Mirco Kroon | Save smaller version of images to reduce memory used on start |
| 2023-08-23 | `8f05210` | Mirco Kroon | Downscale images when loading in |
| 2023-08-23 | `087591d` | Mirco Kroon | Dynamically resize overview images |
| 2023-08-21 | `7139106` | Mirco Kroon | Added switching between rendering modes |

← file-history index
