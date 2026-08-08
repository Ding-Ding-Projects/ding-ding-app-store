# Draw

## Behavior

Draw provides a local SVG canvas with rectangle, ellipse, line, and text creation; selection; drag; duplicate; delete; fill; stroke; and line-width controls.

## Configuration

Shape data and selected tool persist in the workspace. Per-canvas and per-shell appearance remains independent from functional shape colors.

## Failure modes

Unsupported vector operations are handed to LibreOffice Draw. A JSON export is never described as an ODG conversion.

## Security

Shape text is escaped; SVG script, foreign objects, external URLs, and event attributes are not accepted.

## Verification

Electron smoke verifies the canvas. Pointer coordinates are normalized to the view box and every mutation records a workspace revision.

## Suggested articles

[Appearance](app-doc://article/material-office.repository.3c9bb62f3d430b57) · [Version history](app-doc://article/material-office.repository.62978229518ad58e) · [LibreOffice integration](app-doc://article/material-office.repository.945def60ac462e7d)
