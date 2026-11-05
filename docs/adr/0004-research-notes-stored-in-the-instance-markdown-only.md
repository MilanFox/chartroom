# Research notes are stored in the Instance, Markdown only

Chartroom holds process material, never results: everything within an Effort is disposable, and results end in the client repo. Research output so far lived in untracked `.scratch/` folders or unmerged local `research/<name>` branches, linked from issues through ad-hoc `file://` or `git:` URLs that only resolve on one laptop, so nobody else could read it. All of it was Markdown of 5–40 KB. We store it in the Instance as Research notes: Markdown bodies of at most 512 KB, attached to exactly one issue of any Kind and addressed by issue and slug (`#3/local-transcription`). A Research note is not a Kind, so ADR 0001 stands: it gets no number, Claim, labels, comments or blockers, and carries no category of its own; what kind of work produced it is read from its issue.

## Considered Options

- Link-only (status quo): the Link points at a file on one machine or a branch that is never pushed, so the note is unreadable to anyone else and lost with the laptop.
- A fifth Kind: would give notes numbers, Claims, labels and comments they never need, and break the four-Kind model of ADR 0001.
- Storing binaries too (screenshots, HTML prototypes, code): grows the SQLite file and every Snapshot (ADR 0003); deferred as a separate decision. Binary artifacts stay Artifact Links.

## Consequences

- Re-posting the same slug on the same issue replaces the body. The Change records who, when and the new size, not the old body, so earlier versions are not kept.
- Notes stay editable after their issue closes.
- The Dashboard gets a Research section rolling up every Research note of the Effort.
- Since the store now grows with text, it is made manually declutterable rather than designed for unbounded growth: an Admin may permanently delete a closed Effort with its subtree (a Snapshot is taken first, then the store is vacuumed), and an Admin may delete individual Snapshots, with each one's size and the total shown. Nothing is pruned automatically.
