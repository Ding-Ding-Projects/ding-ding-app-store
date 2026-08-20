# Release features

- [Native Windows installer](app-doc://article/bambu-studio.repository.3480a21e157dfff4)
- [Build from source (Windows installer)](app-doc://article/bambu-studio.repository.8132b41cb4bb04d6)
- [One-click local Windows build and installer](app-doc://article/bambu-studio.repository.324a8cf7ad7a2b9f)
- [Windows CI and release supply chain](app-doc://article/bambu-studio.repository.993afdf448022562)
- [Release codenames](app-doc://article/bambu-studio.repository.b1ff5ffddaeb30dd) — the Hong Kong dish roster every release is named from

This fork intentionally publishes a Windows installer only. Automatic upstream WinGet and Homebrew
jobs are gated to the upstream `bambulab/BambuStudio` repository so fork releases cannot mutate those
external package feeds.

No Postman collection is applicable: this category exposes no HTTP API.
