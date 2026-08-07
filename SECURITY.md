# Security policy

Report vulnerabilities privately through GitHub's security advisory interface. Do not include credentials, private repository data, or exploit payloads in a public issue.

The App Store treats repository and release metadata as untrusted input. Only reviewed catalog records, fixed adapters, allowlisted HTTPS origins, bounded downloads, and verified SHA-256 digests may reach an installer. The renderer has no Node access and cannot provide executable paths, commands, or arguments.

Windows builds are intentionally unsigned under the project's permanent no-signing policy. Transport integrity and package hashes do not constitute a code signature.
