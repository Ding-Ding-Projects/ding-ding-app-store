# Base

## Behavior

Base provides four distinct working views without requiring a network database. Tables edit records directly; Queries apply field-aware contains, equals, starts-with, and numeric comparison predicates; Forms create and save one selected record; Reports calculate row counts, numeric totals, and status breakdowns with Markdown export. CSV import/export and durable history apply to the same local data.

## Configuration

Records use collision-free stable IDs and persist in the app-owned workspace. Text or bounded-regex search composes with the query predicate. Query state, form draft, selected record, and object view remain independent.

## Failure modes

The in-app record grid is not a replacement for LibreOffice Base database drivers. ODB behavior opens in LibreOffice. Malformed, oversized, changing, non-UTF-8, or non-CSV input reports an exact limitation without altering current records.

## Security

No SQL or network endpoint is exposed. Query operators are fixed predicates rather than executable expressions. Record values are bounded JSON, CSV output is quoted, and native file selection remains in the main process.

## Verification

Electron smoke drives table record creation, runs a query, saves through the form, and verifies the calculated report surface. Static renderer checks require an explicit handler for every rendered action. Persistence and real Git restore tests cover records inside workspace snapshots.

## Suggested articles

[Version history](app-doc://article/material-office.repository.62978229518ad58e) · [LibreOffice integration](app-doc://article/material-office.repository.945def60ac462e7d) · [Tabs and search](app-doc://article/material-office.repository.477a1072906b827c)
