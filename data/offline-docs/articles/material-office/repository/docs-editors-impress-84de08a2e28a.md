# Impress

## Behavior

Impress supports editable slide titles/bodies, thumbnails, add, duplicate, delete, layout selection, ordering, and full-screen presentation with previous/next controls.

## Configuration

Slides, active slide, layout, theme, font, zoom, and tab placement persist in workspace state.

## Failure modes

Complex imported presentation animation and media are delegated to LibreOffice. In-app JSON export is labeled portable data, not an ODP conversion.

## Security

Slide text is escaped before preview and presentation. External media is not loaded automatically.

## Verification

Electron smoke verifies thumbnails and the active canvas. The app blocks deletion of the final remaining slide.

## Suggested articles

[LibreOffice integration](app-doc://article/material-office.repository.945def60ac462e7d) · [Appearance](app-doc://article/material-office.repository.3c9bb62f3d430b57) · [Notifications](app-doc://article/material-office.repository.0b6d47771c99bb5c)
