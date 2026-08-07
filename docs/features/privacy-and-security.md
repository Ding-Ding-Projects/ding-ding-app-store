# Privacy and security

## Behaviour

The App Store minimizes retained data to catalog preferences, explicit installation records, local operation history, and user-selected settings. It presents why each operation needs a path, network request, or privilege before it runs and keeps non-decision status in non-blocking notifications.

## Configuration

Users can inspect and export their app-managed records in faithful formats, choose local history retention where applicable, and adjust notification/appearance/language settings without changing product identity or update-feed identity. Sensitive values use operating-system credential storage rather than application configuration files.

## Failure modes

Unavailable credential storage, denied permission, malformed configuration, unavailable network, unsupported export, and failed history write report the actual condition and preserve the primary user operation when safely possible. A status error never discloses a secret or private token.

## Security considerations

URLs, paths, catalog data, and update metadata are validated at privileged boundaries. Source builds are explicitly risky and isolated; installers and uninstallers are constrained to known ownership; logs redact secrets; and local version history preserves existing encryption rather than copying plaintext into a second store.

## Verification

The documentation states the expected trust boundaries. Threat modelling, credential-store integration, installer execution, and end-to-end privacy tests remain unverified in this docs-only lane.

## Suggested articles

Read [source-build security](source-build-security.md), [verified installer operations](verified-installer-operations.md), and [verification](verification.md).
