# Self-Hosting (Docker)

> 🚧 **Planned — not yet available.** The Dockerfile ships with Milestone 5. This page documents the intended design and will gain real commands once the image exists.

## Concept

One container runs everything:

- **Web UI** (React + TypeScript, Material Design 3) served to any browser
- **Backend** serving the library over HTTP — browse, view, stream photos & videos
- **Original-file downloads** — fetch the unmodified image/video from any device
- **AI indexing** running on the host — your library never leaves your machine

## Planned usage

```bash
docker run -d \
  -p 8080:8080 \
  -v /path/to/your/photos:/library \
  --name photo-viewer \
  photo-viewer
```

Then open `http://<host>:8080` from your phone, tablet, or desktop.

## Planned configuration

| Setting | Default | Purpose |
|---|---|---|
| `PORT` | `8080` | Web UI / API port |
| `/library` volume | — | Your photos folder (mounted read-write so the app can git-init it for local history) |
| Index storage | container volume | Persistent AI indexes, searchable across restarts |

## Notes

- Large videos are split into **max 1 GB** parts.
- The photos folder is **git-initialized** by the app for local snapshot history.
- `docker-compose.yml` will be included for convenience.
