# Data, recovery and history

| Feature | Contract | Status |
| --- | --- | --- |
| Transfer/settings history | [Local version history](app-doc://article/jdownloader-material.repository.a18da4d137c18578) | Implemented |
| Workspace history | [Local version history](app-doc://article/jdownloader-material.repository.a18da4d137c18578#workspace-history) | Implemented |
| Restart journal | [Architecture](app-doc://article/jdownloader-material.repository.ff21b6b9a3a33e9d#restart-state) | Implemented |

The app owns Downloads, LinkGrabber records, settings and workspace structure. Transfer/settings
state and workspace structure use separate private append-only JGit repositories. Appearance and
notification history use bounded atomic local stores; their Settings controls remain inside the
main settings snapshot.
