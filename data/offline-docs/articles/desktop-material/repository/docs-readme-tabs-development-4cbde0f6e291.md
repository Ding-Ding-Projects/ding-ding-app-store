[Overview](app-doc://article/desktop-material.repository.b335630551682c19) · [Install](app-doc://article/desktop-material.repository.1e1a5fc33dbd396e) · [Features](app-doc://article/desktop-material.repository.d2e40a408df25474) · [Complete list](app-doc://article/desktop-material.repository.393cc524ab83ec92) · [Screenshots](app-doc://article/desktop-material.repository.5427e8e90f762374) · [Roadmap & receipts](app-doc://article/desktop-material.repository.78d607cf57dbb567) · **Development**

Tabbed README — GitHub can't run scripts, so each tab above is a separate page.

# Development

## Building

Full instructions live in [`docs/contributing/setup.md`](app-doc://article/desktop-material.repository.6bbce1a00596b7d6). In short, with Node 24.15.0:

```
yarn && yarn build:dev && yarn start
```

For historical reproduction only, the archived July 27 Linux TUI prototype
used this locked Python project:

```bash
cd tui
uv sync --locked --extra dev
uv run pytest
uv run desktop-material-tui
```

Its archived contributor, package, interaction, and verification record is in
the [historical Linux TUI documentation](app-doc://article/desktop-material.repository.15fc41b41822766b).
Those lanes are not current supported-product or Windows-release gates.
