# Release manifest

The in-app release manifest at `src/release-info.json` is the user-facing source for the current version, release date, exact source commit, release-notes URL, bilingual dim-sum code name, and published public photo URL.

## Behavior

- The current entry matches the newest history entry, currently v0.1.11.
- Every history entry links to the exact commit that delivered it.
- Each code name is resolved from the public catalog and is unique within this project history.
- The app's Changelog and About surfaces use the same manifest, so they cannot silently disagree about the current release.

## Failure modes and security

The manifest validator rejects duplicate versions, reused code names, malformed full commit SHAs, non-project release URLs, and non-bilingual code names. It does not download or vendor public photos. Photo URLs remain links to the public catalog release; runtime caching stays in application data.

## Verification

Run `npm run check`. This runs the catalog validator, source syntax checks, and `data/validate-release-info.mjs`, which currently reports 11 release entries with unique bilingual code names. The latest verified Windows release is [v0.1.11](https://github.com/Ding-Ding-Projects/dim-sum-atlas/releases/tag/v0.1.11), targeting `8737f9c`.

## Suggested articles

- [README](app-doc://article/dim-sum-atlas.repository.b335630551682c19)
- Roadmap
- Handoff
