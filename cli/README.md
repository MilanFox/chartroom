# chartroom-cli

Every Chartroom tracker operation from the shell. One verb per API route; output is the API's JSON, pretty-printed on stdout.

## Install

No install needed. Run it with the major version of your Instance, `0` while it is `0.x`:

```sh
npx -y chartroom-cli@<major> me
```

Installed globally (`npm install -g chartroom-cli@<major>`), the binary is `chartroom` with the aliases `chart` and `chartroom-cli`. The examples below use `chart`. Node 24 or newer.

## Auth

| Variable | Flag | Meaning |
| --- | --- | --- |
| `CHARTROOM_URL` | `--url` | Instance base URL, e.g. `https://chartroom.example.com`. |
| `CHARTROOM_TOKEN` | `--token` | A Token holder's secret, sent as a bearer token. The holder is the actor on every write. |

Flags override the environment per call, except on `issue link add`, where `--url` is the Link target. No login command, no config file.

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
| Print the Adapter files, or write them to a directory | `chart adapter --write docs/agents` |

## Shared flags

| Flag | Meaning |
| --- | --- |
| `--body-file -` | Any `*-file` flag reads stdin when given `-`. |
| `--limit`, `--cursor` | Page through a list verb; output is `{ items, nextCursor }`. |
| `--all` | Follow every cursor and print a plain array. |

## Output and exit codes

| Exit | Meaning |
| --- | --- |
| `0` | Success. JSON on stdout; `effort artifacts` and `adapter` print markdown. |
| `1` | The API's error envelope on stderr, or `unreachable` when the Instance cannot be reached. |
| `2` | Usage error; the usage list follows on stderr. |

When the Instance's major version differs from the CLI's, one line on stderr names the right `npx -y chartroom-cli@<major>`, then the call proceeds.

## API reference

Every verb maps to one route of the HTTP API. Your Instance serves the reference at `<CHARTROOM_URL>/api/docs` and the OpenAPI document at `<CHARTROOM_URL>/api/v1/openapi.json`.
