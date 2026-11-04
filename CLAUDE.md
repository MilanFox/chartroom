## Agent skills

### Issue tracker

Issues live as local markdown files under `.scratch/<feature>/`. See `docs/agents/issue-tracker.md`.

### Triage labels

Default five canonical labels (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`), recorded as a `Status:` line in each issue file. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: root `GLOSSARY.md` + `docs/adr/`. See `docs/agents/domain.md`.

## Git workflow

- Conventional commits (`feat:`, `fix:`, `docs:`, `chore:`), subject under 72 chars, body only when the why is not obvious. History holds real work only; `.scratch/` is never committed.
- Wayfinder phase: commit directly on `main`. Implementation phase: branch per ticket (tiny related tickets may share one), PR per branch, merged by the agent with a merge commit, never squashed.
- A PR that touches `docs/adr/` or `GLOSSARY.md` is not merged by the agent: say so in chat and wait.
- Push only on explicit request.
- Releases: `docs/releasing.md` (cut, check, npm and GHCR setup, incident response).
