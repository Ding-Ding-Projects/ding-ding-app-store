[Overview](app-doc://article/desktop-material.repository.b335630551682c19) · [Install](app-doc://article/desktop-material.repository.1e1a5fc33dbd396e) · [Features](app-doc://article/desktop-material.repository.d2e40a408df25474) · [Complete list](app-doc://article/desktop-material.repository.393cc524ab83ec92) · **Screenshots** · [Roadmap & receipts](app-doc://article/desktop-material.repository.78d607cf57dbb567) · [Development](app-doc://article/desktop-material.repository.4cbde0f6e291fe79)

Tabbed README — GitHub can't run scripts, so each tab above is a separate page.

# Screenshots

## Original GitHub OAuth callback acceptance

The dated production-build receipt proves that Desktop Material's app-owned
browser reaches the original registered GitHub OAuth application without the
reported `redirect_uri` warning. The frame contains empty sign-in fields and no
account or credential data.

*Image omitted from the offline bundle: Real app-owned GitHub authorization page opened without a redirect URI warning.*

[Read the exact-source verification receipt](app-doc://article/desktop-material.repository.c783e4c18a28fa63).

The compact selection below keeps this README scannable. The
[guided feature gallery](app-doc://article/desktop-material.repository.cdbea53fe49d1ada) and
[task-oriented tutorial](app-doc://article/desktop-material.repository.d803c72c98a6f418) contain the full annotated
set.

The wiki now also includes a visual-learning layer: eight labeled workflow
diagrams—one on every wiki page—and seven conceptual illustrations covering the
safe Git loop, short-lived branches, conflict resolution, rebase, stash recovery,
automation, and account isolation. The diagrams are reproducible with
`node script/generate-wiki-diagrams.js`.

| Launchpad full-width empty state |
| --- |
| *Image or external asset omitted from the offline bundle.*Full-width empty state · five truthful zero-count groups · cheap Lowlevel hidden-desktop capture |

| Merge chooser freshness filter |
| --- |
| *Image or external asset omitted from the offline bundle.*Not updated with main · 960×660 client-only hidden-desktop capture · SHA-256 `DA046E4BC768324BAFF001B5DE0C7954F53F1CD498C25338081E8FDB83990346` |

## Historical Linux terminal captures

Five original-resolution Debian/Xvfb captures remain preserved with their
[dated run manifest](app-doc://article/desktop-material.repository.fa52a92ee8de19fe).
They are historical evidence, not current Windows screenshots, and are
therefore excluded from the 91-scene guided-gallery target, Pages manifest,
and current refresh campaign.

## Inherited external-UI assets — excluded from the capture mandate

Every screenshot of **Desktop Material's own interface** is produced by the
app's capture harness and is replaceable on demand. Six inherited assets are a
documented exception, because they show **other products' interfaces** that
this app cannot render and the harness therefore cannot reproduce:

| Asset | External interface shown |
| --- | --- |
| `../assets/git-credential-manager.png` | Git Credential Manager (Windows) |
| `../assets/ado-prompt.png` | Azure DevOps sign-in prompt |
| `../assets/bitbucket-prompt.png` | Bitbucket sign-in prompt |
| `../assets/gitlab-prompt.png` | GitLab sign-in prompt |
| `../assets/unreachable-commits-history.png` | Upstream GitHub Desktop docs |
| `../assets/unreachable-commits-demo.gif` | Upstream GitHub Desktop docs |

They are referenced from `docs/integrations/azure-devops.md`,
`docs/integrations/bitbucket.md`, `docs/integrations/gitlab.md`, and
`docs/learn-more/unreachable-commits.md`, where they illustrate third-party
sign-in flows a user meets outside this app.

Recapturing them would require live Azure DevOps, Bitbucket, and GitLab
accounts plus a credential-prompt environment, and the result would still be
someone else's UI rather than evidence about this app. They are therefore
**excluded** from "replace every screenshot" work and are not counted against
capture coverage. Decision recorded 2026-07-27 (issue #25, option A). Anyone
adding a new external-product screenshot should list it here with the same
justification rather than leaving it to be mistaken for a stale app capture.

## Current settings surfaces — browser-tab acceptance

These three frames come from the exact production Electron build on the named
hidden desktop run recorded in
`settings-browser-tabs-headless-run-manifest.json`.
They show the shared browser-style tab lane on Global Settings, Repository
Settings, and Stash Manager, including close actions, search/overflow/new-page
controls, and the active panel below the selected page.

| Global Settings | Repository Settings | Stash Manager |
| --- | --- | --- |
| *Image or external asset omitted from the offline bundle.*SHA-256 `43ff361771efeeeb01eb8b40b778b9a4e5b3a311457fc632271d9ad4aa513fc` | *Image or external asset omitted from the offline bundle.*SHA-256 `4850a060ed8ffb9c8fd06bf013e6b503b4928c58bf0449c45e56887be09ad962` | *Image or external asset omitted from the offline bundle.*SHA-256 `52254a7b62ba0a9ce3d84c19fe3cd5e4e30a37ede79d3122afa57665b9759ca3` |

全域設定、倉庫設定同 Stash 管理員而家共用同一條似瀏覽器嘅分頁列；開新頁、關頁同搵滿瀉分頁都係同一套手勢。

| Searchable Publish organization owner |
| --- |
| *Image or external asset omitted from the offline bundle.*Personal or organization owner · fuzzy/substring/safe regex · non-collapsing contained list |

| Custom app identity | Material Welcome | Appearance customization | Dynamic toolbar overflow |
| --- | --- | --- | --- |
| *Image or external asset omitted from the offline bundle.*Profile app identity | *Image or external asset omitted from the offline bundle.*Material Welcome | *Image or external asset omitted from the offline bundle.*Anchored owner · burst-safe history | *Image or external asset omitted from the offline bundle.*Measured More behavior |

| Word-style tab appearance | Arrange tabs | Actions cancellation | Reviewed rebase |
| --- | --- | --- | --- |
| *Image or external asset omitted from the offline bundle.*Per-tab appearance | *Image or external asset omitted from the offline bundle.*Persistent tab order | *Image or external asset omitted from the offline bundle.*Exact-run cancellation | *Image or external asset omitted from the offline bundle.*Rebase review |

| Persistent tab groups | Rich command palette |
| --- | --- |
| *Image or external asset omitted from the offline bundle.*Named chip · collapse/expand · restart persistence | *Image or external asset omitted from the offline bundle.*Aligned controls · stable random per repository |

| Live Cheap LFS pin and restore | Live cloud compression |
| --- | --- |
| *Image or external asset omitted from the offline bundle.*Public/private live GitHub · native picker · pushed pointer history | *Image or external asset omitted from the offline bundle.*Private opt-in · no private workflow · 99.9% smaller |

| Detailed Cheap LFS commit progress | Compact Repository Releases at 200% |
| --- | --- |
| *Image or external asset omitted from the offline bundle.*Three lanes · queue/provider context · timing and ETA · keyboard disclosure | *Image or external asset omitted from the offline bundle.*100–200% gate · complete row · 24-hour time |

| Live 14.8 GB Bambu Cheap LFS restore |
| --- |
| *Image or external asset omitted from the offline bundle.*8,305 files · four proven UI batches · ten pointers · separate 10/10 clone hash proof |



| Current-source automatic updater ready | Historical cross-lane automatic update recovery |
| --- | --- |
| *Image or external asset omitted from the offline bundle.*Accepted current-source frame · runtime `b069384ad7d8a65d1192ee06859a705fe484c9c8` · promoted `e3967f1b81ec039624500797dca40a1ab6d98598` · 960×660 · 47,086 bytes · SHA-256 `0fc9caf5b13eb5b914121090f403c394545e02ea4303b11dd4598afcb3a2dfca` · development proof, not a published payload目前原始碼畫面已驗收 · 真 Electron/Squirrel 路徑配驗證器自有嘅無害 payload · 唔代表已發佈更新 payload | *Image or external asset omitted from the offline bundle.*Immutable July 22 evidence · legacy s lane → shared z lane · real Squirrel download |



Cheap LFS can now install a reviewed, SHA-pinned GitHub Actions caller that
compresses Release objects sequentially without Actions artifacts or caches.
For a confirmed-public repository, Desktop Material automatically prepares the
owned caller in Changes; it starts running only after the user reviews, commits,
and pushes that workflow. Private repositories stay off until the user opts in;
that persisted consent installs no private-repository workflow and spends no
private Actions minutes, routing compression through the encrypted public
builder instead. Failed or non-beneficial objects keep their exact raw pointer
and asset, while successful objects become backward-compatible `part-deflate`
records. Decompression always happens locally in Desktop Material with bounded
expansion plus original part and whole-file SHA-256 verification. The historical
2026-07-22 public and private Actions acceptance converted separate 1 MiB
objects to verified 1,033-byte side assets while retaining their raw historical
assets; both compressed pointers restored to the exact original bytes through
the app.

| Repository workflows | GitHub workflows | Accessibility and shell |
| --- | --- | --- |
| *Image or external asset omitted from the offline bundle.*Repository Tools | *Image or external asset omitted from the offline bundle.*Actions caches | *Image or external asset omitted from the offline bundle.*200% auto-fit |
| *Image or external asset omitted from the offline bundle.*Pull All | *Image or external asset omitted from the offline bundle.*Pull requests | *Image or external asset omitted from the offline bundle.*Changes workspace |
| *Image or external asset omitted from the offline bundle.*Stash manager | *Image or external asset omitted from the offline bundle.*Issues | *Image or external asset omitted from the offline bundle.*Responsive clipping gate |

| Runtime tab search | History commit actions | Repository Tools at the true bottom |
| --- | --- | --- |
| *Image or external asset omitted from the offline bundle.*Search and switch tabs | *Image or external asset omitted from the offline bundle.*Right-click and keyboard-equivalent actions | *Image or external asset omitted from the offline bundle.*Verified bottom reachability |

*Image omitted from the offline bundle: History commit hover card showing an exact timestamp and relative age.*

| History view tabs — List | History view tabs — Graph |
| --- | --- |
| *Image or external asset omitted from the offline bundle.*Commit list | *Image or external asset omitted from the offline bundle.*Graph |

| GitHub API functions |
| --- |
| *Image or external asset omitted from the offline bundle.*Auto-added read functions · hideable API rail item · reviewed custom requests |

| Custom repository-logo studio | Named API app functions |
| --- | --- |
| *Image or external asset omitted from the offline bundle.*Safe vector layers · profile default · repository override | *Image or external asset omitted from the offline bundle.*Versioned definitions · exact binding · reviewed execution |

| Temporary submodule repository navigation |
| --- |
| *Image or external asset omitted from the offline bundle.*No repository import · customizable Back control · root return |

| Reviewed ordinary Git pull |
| --- |
| *Image or external asset omitted from the offline bundle.*Fresh fetch · exact reviewed OID · no second fetch |

| Advanced Git and collaboration workflows |
| --- |
| *Image or external asset omitted from the offline bundle.*Local and remote inventory · reviewed mutations · responsive workflow surface |

| Local Ollama model lifecycle |
| --- |
| *Image or external asset omitted from the offline bundle.*Health · inventory · pull · copy/rename · load/unload · confirmed delete |


Open 31 more verified screenshots

| Clone and checkout | Repository administration | Accounts and automation |
| --- | --- | --- |
| *Image or external asset omitted from the offline bundle.*Account-aware clone | *Image or external asset omitted from the offline bundle.*Clone-style submodules | *Image or external asset omitted from the offline bundle.*Remote manager |
| *Image or external asset omitted from the offline bundle.*Shallow clone | *Image or external asset omitted from the offline bundle.*Gitignore manager | *Image or external asset omitted from the offline bundle.*Automation |
| *Image or external asset omitted from the offline bundle.*Guided sparse-checkout review | *Image or external asset omitted from the offline bundle.*History deepening | *Image or external asset omitted from the offline bundle.*Agent access |
| *Image or external asset omitted from the offline bundle.*Branches | *Image or external asset omitted from the offline bundle.*Collapsible repository filters | *Image or external asset omitted from the offline bundle.*Searchable publish owner |
| *Image or external asset omitted from the offline bundle.*History search | *Image or external asset omitted from the offline bundle.*Merge All | *Image or external asset omitted from the offline bundle.*Multi-window |
| *Image or external asset omitted from the offline bundle.*Bulk notification triage |  |  |
| *Image or external asset omitted from the offline bundle.*Safe regex builder | *Image or external asset omitted from the offline bundle.*Settings history | *Image or external asset omitted from the offline bundle.*Stale-lock recovery |

| Pull requests and rules | Actions | Releases, issues, and providers |
| --- | --- | --- |
| *Image or external asset omitted from the offline bundle.*Create pull request | *Image or external asset omitted from the offline bundle.*Job log | *Image or external asset omitted from the offline bundle.*Releases dashboard |
| *Image or external asset omitted from the offline bundle.*Branch rules | *Image or external asset omitted from the offline bundle.*Artifact download | *Image or external asset omitted from the offline bundle.*Provider triage |
| *Image or external asset omitted from the offline bundle.*Deployment review | *Image or external asset omitted from the offline bundle.*Run pagination | *Image or external asset omitted from the offline bundle.*GitHub notifications |
| *Image or external asset omitted from the offline bundle.*Attempt-aware jobs | *Image or external asset omitted from the offline bundle.*Artifact pagination | *Image or external asset omitted from the offline bundle.*Artifact provenance |
