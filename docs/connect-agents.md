# Connect your agents

From an empty machine to agents filing and closing tickets in Chartroom, for a repo that uses [Matt Pocock's skills](https://github.com/mattpocock/skills).

## 1. What you end up with

- One Instance per project, running in Docker.
- Your agents read and write issues through the `chartroom` CLI, told how by the Adapter files in `docs/agents/`.
- Humans, testers and clients follow along in the web UI.

## 2. Start an Instance

```sh
npx -y chartroom-cli@latest init my-chartroom
```

The wizard asks for the admin and viewer passwords, the public URL and the port, then offers to start the container. If you don't let it start, run `cd my-chartroom && docker compose up -d`. The Instance listens on `http://localhost:3000` by default.

For TLS, a reverse proxy and production use, see [Operating an Instance](operating.md).

## 3. First run

1. Open the Instance and sign in with the viewer password.
2. Elevate with the admin password ("Enter admin password…").
3. Create a Token holder under **Admin → Token holders**. Copy its secret; it is shown once.

Every write is recorded under the Token holder whose secret made it. One holder per developer, or one per agent setup, both work. **Rotate** issues a new secret and **Revoke** ends a holder for good; both are on the same admin page.

## 4. Install the CLI

```sh
npm install -g chartroom-cli@0
```

Use the Instance's major version, `0` today. `chartroom instance` or **Admin → About** shows the Instance's version. Node 24 or newer.

The Adapter files tell agents to run `chartroom …`, so the binary must be on the `PATH`. Without a global install, `npx -y chartroom-cli@0 <command>` runs the same thing.

## 5. Configure the project repo

Run these in your project repo.

**a. Run `/setup-matt-pocock-skills`.**

- At "Issue tracker" pick **Other** and give it this paragraph, with your URL:

  ```text
  Chartroom at http://localhost:3000; run chartroom adapter --write docs/agents
  ```

- If it asks about triage labels (only when the `triage` skill is installed), keep the defaults.

The skill writes the `## Agent skills` block into `CLAUDE.md` (or `AGENTS.md`), `docs/agents/domain.md`, a placeholder `docs/agents/issue-tracker.md` and, with `triage` installed, `docs/agents/triage-labels.md`.

**b. Put the URL and secret in `.env`.**

```sh
CHARTROOM_URL=http://localhost:3000
CHARTROOM_TOKEN=<the Token holder's secret>
```

Make sure `.env` is in `.gitignore`. The CLI reads `.env` from the current directory. Variables already set in the environment win over it.

**c. Write the Adapter files.**

```sh
chartroom adapter --write docs/agents
```

This replaces the skill's `docs/agents/issue-tracker.md` and `docs/agents/triage-labels.md` with versions for your Instance. Commit them.

Re-run it after you change the Effort's Display label, the triage Display labels or the Label groups on the admin page.

## 6. Let Claude Code run it without prompting (optional)

Add this to the project settings, `.claude/settings.json` (committed, shared) or `.claude/settings.local.json` (just you), or to the user settings, `~/.claude/settings.json` (all your projects):

```json
{
  "permissions": {
    "allow": ["Bash(chartroom *)"]
  }
}
```

A rule in the shared `.claude/settings.json` applies for each teammate once they trust the folder in Claude Code.

## 7. Check it works

```sh
chartroom me
```

This prints the Token holder you act as. Then do a first real run in Claude Code:

| You run | The agent does in Chartroom | Where to look |
| --- | --- | --- |
| `/to-spec` on an idea | Creates the Effort if it doesn't exist yet, then a spec under it labelled `ready-for-agent` | The Effort list (`/`) and the Effort's Dashboard |
| `/to-tickets` | Creates tickets under the spec, `ready-for-agent`, each with its blocking edges | The spec's page, with its Dependency graph |
| `/implement <n>` | After merging, adds the branch or PR as an Artifact Link and closes the ticket with a Resolution | The ticket's page; the graph marks it closed |

## 8. Day to day

| You want | Where |
| --- | --- |
| Every open issue, with filters and Saved views | Workbench, `/issues` |
| One Effort's map, specs, triage and Links | That Effort's Dashboard |
| Tell testers what to test, and where | Test instructions on the Effort's Dashboard, next to the Environments (**Admin → Environments & credentials**) |
| Share read-only with testers or clients | Give them the URL and the viewer password |
| Snapshots | **Admin → Snapshots**; see [Store and volume](operating.md#store-and-volume) |

## 9. Troubleshooting

| You see | Cause | Fix |
| --- | --- | --- |
| `unauthenticated` | Missing or wrong `CHARTROOM_TOKEN`, a revoked Token holder, or no Token holder created yet | Check `.env` and any exported variable; create or rotate a holder on the admin page |
| `unreachable` | Wrong `CHARTROOM_URL` or port, or the container is down | `docker compose ps` in the Instance folder; `docker compose up -d` |
| A stderr line saying the Instance and the CLI versions differ | The CLI's major doesn't match the Instance's | Install the major it names: `npm install -g chartroom-cli@<major>` |
| The agent still writes files under `.scratch/` | The Adapter files weren't written or committed, or the `## Agent skills` block in `CLAUDE.md` still points at local markdown | Re-run step 5c and commit; fix the block to point at `docs/agents/issue-tracker.md` |
| The agent uses an old Effort or triage Display label | The Adapter files predate a settings change | `chartroom adapter --write docs/agents` and commit |

## 10. Uninstall

See [Uninstall](operating.md#uninstall).
