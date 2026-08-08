# Verifying the port

`design/` is a byte-for-byte copy of the upstream project — same bytes, same file
modes, same object ids. That is a claim a script can settle, so a script settles
it:

```sh
sh scripts/verify-port.sh
```

It exits 0 only when there are no gaps, and prints a counter for each way a copy
can go wrong.

## Two checks, because they fail differently

**Bytes on disk.** Every file is hashed with `git hash-object --no-filters` and
compared against the upstream object id. This catches a stray edit, a truncated
copy, or a missing file.

**What git recorded.** Every tracked path under `design/` is compared on **mode
and object id**. This catches line endings being normalised and executable bits
falling off — neither of which the byte check can see, because both happen
between the working tree and the index.

## The licence notice is the allowlist

`MODIFICATIONS.md` is simultaneously the Apache-2.0 §4(b) "prominent notice" for
changed files **and** the list the verifier reads as its allowlist.

- A file that differs from upstream **without** an entry → verification fails.
- An entry for a file that **no longer** differs → verification also fails, as a
  stale notice.

So the paperwork and the code cannot drift apart: the check requires them to
agree. Adding a legitimate change means writing down that you made it.

## What the counters mean

| Counter | Meaning |
|---|---|
| `expected` / `tracked` / `present` | How many files upstream has, how many are tracked here, how many exist on disk |
| `declared` | Paths listed in `MODIFICATIONS.md` — this rises as the redesign lands |
| `missing` | A file that should exist and does not |
| `bytes differ` | Contents changed |
| `mode mismatch` | A lost executable bit |
| `oid mismatch` | A difference git recorded that the byte check could not see |
| `extra` / `untracked` | Something present that upstream does not have |
| `stale notice` | A declared change that is no longer a change |

**`gaps` is the number that must stay at 0.** Prefer the script's answer to any
prose about it, including this page.

## It does not need the submodule

The upstream tree can be read from the pinned submodule *or* from
`scripts/upstream-manifest.tsv`, a committed table of upstream object ids. The
manifest exists so continuous integration does not clone a 1.7 GB object store on
every push to answer a question about file hashes.

When the submodule **is** present, the manifest is checked against it first and
the run aborts if they disagree — so the shortcut cannot quietly drift from the
thing it stands in for.

## Line endings will fail this if you let them

The verifier hashes the bytes on disk. A checkout with `core.autocrlf=true`
rewrites LF to CRLF under `design/`, and the verifier then reports thousands of
`bytes differ` results that have nothing to do with your change.

Configure `core.autocrlf=false` **before** checking out, or run the verifier on a
platform that does not translate line endings. The CI job sets this explicitly
rather than relying on the runner's default.
