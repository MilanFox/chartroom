# chartroom-cli

Every Chartroom tracker operation from the shell. One verb per API route; output is the API's JSON, pretty-printed on stdout.

## Install

Install it globally at the major version of your Instance, `0` while it is `0.x`. The binary is `chartroom`, with the aliases `chart` and `chartroom-cli`, which is what the Adapter's commands call. Node 24 or newer.

```sh
npm install -g chartroom-cli@<major>
chartroom me
```

Without an install, prefix each command with `npx -y chartroom-cli@<major>` instead. The examples below use `chart`.

## Start an Instance

```sh
npx -y chartroom-cli@latest init my-chartroom
```

Writes `compose.yaml` and `.env` into `my-chartroom/` (default: the current directory), then prints a first-start checklist. In a terminal it walks seven steps, and you choose both passwords: admin and viewer password, public URL, host port, update check, review, start now. Otherwise it generates both passwords into `.env` and takes every default. The container is named after the directory, prefixed with `chartroom-` unless the name already contains it. `.env` also sets `CHARTROOM_PROJECT_NAME` to the directory name, shown until a project name is saved in Settings. Output is coloured only on a terminal without `NO_COLOR`. Needs no `CHARTROOM_URL` or `CHARTROOM_TOKEN`, and refuses with exit `1` if either file already exists.

## Auth

| Variable | Flag | Meaning |
| --- | --- | --- |
| `CHARTROOM_URL` | `--url` | Instance base URL, e.g. `https://chartroom.example.com`. |
| `CHARTROOM_TOKEN` | `--token` | A Token holder's secret, sent as a bearer token. The holder is the actor on every write. |

Both are also read from `./.env` in the current directory when it exists; the environment wins over the file. Flags override both per call, except on `issue link add`, where `--url` is the Link target. No login command; `init` does not read `./.env`.

```sh
export CHARTROOM_URL=https://chartroom.example.com
export CHARTROOM_TOKEN=<secret>
```

## Issues

| Purpose | Example |
| --- | --- |
| Create an issue | `chart issue create --kind ticket --title "Wire the login" --body-file body.md --parent 3 --label needs-triage --blocked-by 7` |
| Show one issue | `chart issue view 12` |
| List issues by filter or view | `chart issue list --view frontier --label bug --all` |
| Edit fields, optionally guarded by version | `chart issue edit 12 --title "Wire the login page" --if-version 4` |
| Append text under a body section | `chart issue append 12 --section Notes --text "- decided"` |
| Delete an issue | `chart issue delete 12` |
| Assign yourself | `chart issue claim 12` |
| Clear the assignee | `chart issue unassign 12` |
| Close, optionally with a comment | `chart issue close 12 --comment "Shipped in #21"` |
| Reopen | `chart issue reopen 12` |
| Show the change log | `chart issue changes 12 --field title` |
| Add a label | `chart issue label add 12 ready-for-agent` |
| Remove a label | `chart issue label remove 12 needs-triage` |
| Mark as blocked by another issue | `chart issue block 12 --by 7` |
| Remove a blocker | `chart issue unblock 12 --by 7` |
| Comment | `chart issue comment 12 --body "Looks good"` |
| Edit a comment | `chart issue comment edit 12 5 --body "Looks great"` |
| Delete a comment | `chart issue comment delete 12 5` |
| Add a Link | `chart issue link add 12 --role artifact --type branch --url https://github.com/acme/app/tree/login --title "Login branch"` |
| Edit a Link | `chart issue link edit 12 3 --title "Login PR"` |
| Remove a Link | `chart issue link remove 12 3` |

`issue list` takes `--kind`, `--state`, `--label`, `--parent`, `--effort`, `--assignee`, `--missing`, `-q`, `--view`, `--sort`, `--order`. `--label` and `--missing` repeat.

## Efforts

| Purpose | Example |
| --- | --- |
| List Efforts | `chart effort list --sort name` |
| Show one Effort by slug or number | `chart effort view handoff` |
| Print the Effort's artifacts as markdown | `chart effort artifacts handoff` |

## Instance

| Purpose | Example |
| --- | --- |
| List Environments | `chart environments` |
| List credential pointers | `chart credential-pointers` |
| List Label groups and labels | `chart labels` |
| List Token holders | `chart holders` |
| Show the holder behind the token | `chart me` |
| Show Instance settings and version | `chart instance` |
| Print both Adapter files, each under a `<!-- docs/agents/<file> -->` marker line | `chart adapter` |
| Write both Adapter files to a directory | `chart adapter --write docs/agents` |

Repo setup goes through `/setup-matt-pocock-skills`: at "Issue tracker" pick Other and answer `` Chartroom at <CHARTROOM_URL>. Run `chartroom adapter` and write each file it prints, verbatim, to the path in its marker line. `` The skill's agent fetches both files itself; `init`'s checklist prints that answer with your URL. After changing settings on the admin page, refresh with `chart adapter --write docs/agents`, or re-run the setup skill.

## Shared flags

| Flag | Meaning |
| --- | --- |
| `--body-file -` | Any `*-file` flag reads stdin when given `-`. |
| `--limit`, `--cursor` | Page through a list verb; output is `{ items, nextCursor }`. |
| `--all` | Follow every cursor and print a plain array. |

## Output and exit codes

| Exit | Meaning |
| --- | --- |
| `0` | Success. JSON on stdout; `effort artifacts` and `adapter` print markdown, `init` prints its checklist as plain text. |
| `1` | The API's error envelope on stderr, `unreachable` when the Instance cannot be reached, or a one-line error when `./.env` exists but cannot be read. |
| `2` | Usage error; the usage list follows on stderr. |

When the Instance's major version differs from the CLI's, one line on stderr names the right `npm install -g chartroom-cli@<major>` and `npx -y chartroom-cli@<major>`, then the call proceeds.

## API reference

Every verb maps to one route of the HTTP API. Your Instance serves the reference at `<CHARTROOM_URL>/api/docs` and the OpenAPI document at `<CHARTROOM_URL>/api/v1/openapi.json`.
