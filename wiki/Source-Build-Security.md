# Source-build security

> **Status: limited.** This wiki page is generated from the canonical categorized article.

## Behaviour

Applications without a reviewed binary adapter can be marked `source-build` and show a Build source action. The main process validates the app identifier and confirms that the catalog record names a source manifest. It then fails closed with an explicit message because this revision has no disposable Windows Sandbox or VM runner. Repository scripts are never executed directly on the host.

The current Build dialog also requires the exact `BUILD <display name>` phrase. No terminal simulator, dependency bootstrap, OpenCode repair loop, or produced application exists in this branch.

## Configuration

Only the source manifest path recorded in the reviewed catalog is visible. Users cannot enter a repository URL, revision, command, working directory, environment block, or output path. There are no hidden host-side defaults that turn the current refusal into execution.

## Failure modes

Unknown apps, a wrong confirmation phrase, or a missing source manifest produce recorded failures. A valid manifest still produces the deliberate `execution is withheld` result. This is a supported safety state: it does not create an installed record or claim that dependencies were installed.

## Security considerations

Source builds execute repository code and therefore require an isolated disposable boundary with pinned revisions, bounded resources, controlled network, no user secrets or host mounts, cancellable process supervision, and allowlisted outputs. None of those requirements is weakened by presenting a Build button. Until all exist together, refusal is safer than running an approximate recipe on a freshly installed Windows host.

## Verification

`src/main/operation-service.ts` contains the explicit fail-closed source path and records the refusal through activity history. Tests can prove that host execution is absent; they cannot prove a build runner that does not exist. Terminal simulation, dependency installation, OpenCode bootstrap, and automatic repair remain pending.

## Suggested articles

- [Verified installer operations](Verified-Installer-Operations)
- [Automatic repair and universal adapters](Automatic-Repair-and-Universal-Adapters)
- [Privacy and security](Privacy-and-Security)
