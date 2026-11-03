# One generic issue table with a fixed kind, not one entity per kind

The skills speak a flat issue/label/comment/blocked-by vocabulary, but the dashboard needs structure (Effort → map/spec → ticket). We model every entity as one generic issue with a fixed `kind` column, a native `parent`, native `blocked-by` edges and exclusive label groups, rather than separate tables for Effort, map, spec and ticket. This keeps every skill operation (comment, label, close, claim, `#n` reference) uniform across kinds and lets kind-specific rules live in validation, not schema. Typed columns stop at Effort; map, spec and ticket bodies stay unparsed markdown so the tracker never couples to the skills' prose.

## Considered Options

- Separate tables per kind: structured, but every generic operation needs per-kind plumbing and `#n` references need a union.
- Labels for kind (`wayfinder:map` etc.): matches the skills' current fallback, but kind drives parent rules and roll-ups and must not be removable.
