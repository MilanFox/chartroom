# Operating an Instance

One Instance is one container, one volume and two passwords. The image serves the UI and the API on port 3000 and keeps its store in `/data`.

## Run in minutes

1. `npx -y chartroom-cli@latest init my-chartroom` asks for the passwords, public URL and port, then writes `compose.yaml` and `.env` into the folder `my-chartroom`, created if missing; any name works. Without Node: copy `compose.example.yaml` to `compose.yaml` and `.env.example` to `.env`, then fill `CHARTROOM_ADMIN_PASSWORD` and `CHARTROOM_VIEWER_PASSWORD`.
2. `cd my-chartroom`
3. `docker compose up -d`
4. `docker compose ps` shows `healthy` once `GET /health` answers; the Instance listens on `127.0.0.1:3000`.

The container refuses to start without either password and names the missing variable in `docker compose logs`. Rotating a password is a restart with the new value; nothing secret lives in the volume.

## Environment variables

| Variable | Default | Meaning |
| --- | --- | --- |
| `CHARTROOM_ADMIN_PASSWORD` | required | Elevates any session to Admin for one hour. |
| `CHARTROOM_VIEWER_PASSWORD` | required | Shared read-only login for the UI. |
| `CHARTROOM_BASE_URL` | derived from the request | Public URL used in absolute links, `url` fields and the setup hint. |
| `CHARTROOM_TRUST_PROXY` | `false` | `true` reads `X-Forwarded-For` and `X-Forwarded-Proto` from the reverse proxy. The compose example sets it. |
| `CHARTROOM_PORT` | `3000` | Port the server listens on inside the container. |
| `CHARTROOM_UPDATE_CHECK` | `true` | `false` stops the check for a newer release at boot and every 24 h. |
| `CHARTROOM_PROJECT_NAME` | none | Project name shown until an Admin saves one in Settings; the saved name then wins. The first save on the Settings card stores the name shown at that moment. `init` writes the folder name formatted as a title. |
| `CHARTROOM_DATA_DIR` | `/data` | Development and tests only, not for production. Keep it out of `.env`. |
| `CHARTROOM_ELEVATION_SECONDS` | `3600` | Development and tests only, not for production. Keep it out of `.env`. |
| `CHARTROOM_RELEASE_URL` | GitHub latest-release API | Development and tests only, not for production. Points the update check at a stub. Keep it out of `.env`. |

## TLS at the reverse proxy

The Instance speaks plain HTTP. TLS is the reverse proxy's job; the compose example publishes the port on loopback only, so the proxy runs on the same host. Caddy obtains the certificate and forwards the client's address and scheme:

```
chartroom.example.com {
	reverse_proxy 127.0.0.1:3000
}
```

With every request arriving through the proxy, `CHARTROOM_TRUST_PROXY=true` lets the auth-failure rate limit count per client instead of throttling everyone behind the proxy's address, and lets the Instance see that the request was `https`. Never set it when the port is reachable without the proxy: anyone could then forge `X-Forwarded-For`.

Set `CHARTROOM_BASE_URL=https://chartroom.example.com` so links in hand-offs, `url` fields and the Adapter files carry the public address regardless of what the proxy forwards.

## Logs

Plain lines on stdout and stderr, nothing written to the volume. `docker compose logs -f chartroom` follows them; rotation is Docker's logging driver's job.

## Store and volume

`/data` holds `chartroom.sqlite`, its `-wal` and `-shm` siblings and `backups/`. The store runs in WAL mode, so:

- The volume must be a local filesystem. No NFS, no SMB, no other network mount.
- Only the Instance process opens the file. Never `cp` the live file, even with the container stopped: the `-wal` sibling may hold writes the main file does not.
- A consistent copy is a Snapshot. "Take Snapshot now" on the admin page writes one to `/data/backups/`, and every row there has a Download. From the shell: `docker compose cp chartroom:/data/backups/<name>.sqlite .`

The Instance never deletes a Snapshot by itself. An elevated Admin deletes them on the admin page, where each row shows its size and the section header the total; a pre-migrate Snapshot deleted there can no longer roll its upgrade back. From the shell, `rm` files in `/data/backups/` works too.

Besides "Take Snapshot now", the Instance takes a Snapshot by itself before an upgrade (below) and before deleting a closed Effort.

### Deleting closed Efforts

An elevated Admin can permanently delete a closed Effort on the admin page, under Closed Efforts: the Effort goes with its maps, specs, tickets, comments, Links, Changes and Research notes. The Instance first takes a Snapshot named `pre-delete-<slug>-<timestamp>.sqlite`; if that fails, nothing is deleted. After the deletion it compacts the store (`VACUUM`), so the file actually shrinks. To get a deleted Effort back, restore its `pre-delete-…` Snapshot: the same file swap as for any other Snapshot (see Rollback), losing whatever was written after it.

## Upgrade

In order:

1. **Instance.** Change the image tag in `compose.yaml` to the new version. Pin a version, never `latest`. Then `docker compose pull` and `docker compose up -d`.
2. **CLI.** Install the Instance's major: `npm install -g chartroom-cli@<major>`, or change the `npx -y chartroom-cli@<major>` pin where you use it. The CLI warns on stderr when its major differs from the Instance's.
3. **Adapter files.** In each connected project run `chartroom adapter --write docs/agents` and commit. Do this on every upgrade: the Adapter text can change in minors.

Migrations are cumulative, so any version jumps straight to any newer one; downtime is the restart. Before migrating, the Instance takes a pre-migrate Snapshot in `/data/backups/`, named `pre-migrate-<old schema>-to-<new version>-<timestamp>.sqlite`, and logs its path. If the Snapshot fails, the boot aborts and nothing is migrated.

### Upgrading from 1.x to 2.0

Breaking changes in the CLI output and the HTTP API:

| Change | 1.x | 2.0 |
| --- | --- | --- |
| `issue list --all`, `research list` (`GET /issues/{n}/research`), `labels`, `holders`, `environments` and `credential-pointers` | bare array | `{ items, nextCursor }`, `nextCursor` is `null` |
| `issue list` without `--all` | `{ items, nextCursor }` | unchanged |
| `children` in `issue view` | issue numbers | `{ number, title, open }`, like `blockedBy` |
| `issue claim` on a ticket already held | succeeds when the holder is the caller's own Token holder | always `conflict`; the Adapter tells agents to stop and ask the user |

Scripts and agents that read these outputs change: `jq '.[]'` becomes `jq '.items[]'`, and `children` entries are read as `.children[].number`. Do not rely on a claim succeeding twice. Adapter files from 1.x describe the old shapes, so refresh them.

Hand this to the coding agent in each connected project:

> Chartroom was upgraded to 2.0. Run `npm install -g chartroom-cli@2` (or change `npx -y chartroom-cli@1` to `@2` where it is pinned). Then run `chartroom adapter --write docs/agents` and commit the changed files with `docs: refresh Chartroom Adapter files for 2.0`. Then search the repo's scripts for uses of `chartroom issue list --all`, `chartroom research list`, `chartroom labels`, `chartroom holders`, `chartroom environments`, `chartroom credential-pointers` and `children` from `chartroom issue view`, and change them to read `.items[]` and `.children[].number`. Do not change anything else.

## Rollback

Migrations are forward-only, so rollback restores the pre-migrate Snapshot. Started on an older image without the swap, the container exits and names the Snapshot to restore, or says none from its schema or older is left.

The swap runs in a throwaway container from the same image, so the files stay owned by `node`. Compose prefixes the volume with the project name, by default the directory holding `compose.yaml`; `docker volume ls` shows it. With project `chartroom`:

```sh
docker compose stop
docker run --rm -v chartroom_chartroom-data:/data ghcr.io/milanfox/chartroom:<previous> ls /data/backups
docker run --rm -v chartroom_chartroom-data:/data ghcr.io/milanfox/chartroom:<previous> sh -c '
  cp /data/backups/<pre-migrate snapshot>.sqlite /data/chartroom.sqlite &&
  rm -f /data/chartroom.sqlite-wal /data/chartroom.sqlite-shm'
```

Then pin `<previous>` in `compose.yaml` and `docker compose up -d`.

Guarantee: as long as its pre-migrate Snapshot is kept, you never lose the state you had before the upgrade; you may lose what was written after it.

Restoring any other Snapshot is the same swap with its file name.

## First run

The first boot creates nothing but the seeded Label groups: no Token holder, no token in the environment. Until the first Token holder exists the API answers every bearer call with `unauthenticated`.

1. Open the Instance and sign in with the viewer password.
2. Elevate with the admin password.
3. Create the first Token holder from the setup checklist on the admin page. Its secret is shown once. The project name, the Effort's Display label and Environments are optional and can change any time.
4. In the project repo, install the CLI and set `CHARTROOM_URL` and `CHARTROOM_TOKEN` in the environment or the repo's untracked `.env`:

   ```sh
   npm install -g chartroom-cli@<major>
   ```

   `<major>` is the Instance's major version, such as `2`; without a global install, prefix commands with `npx -y chartroom-cli@<major>`.
5. Run `/setup-matt-pocock-skills` with **Other** as the issue tracker and answer: "Chartroom at `<url>`. Run `chartroom adapter` and write each file it prints, verbatim, to the path in its marker line." After changing settings, refresh the files with `chartroom adapter --write docs/agents`.

## HTTP API reference

`<your Instance>/api/docs` renders the HTTP API from `/api/v1/openapi.json`, linked from the footer of every UI page. Reading it needs no login, and the page loads nothing from other hosts. Its "try it" panel sends a Token holder's secret as the bearer token and keeps it only until the page is closed or reloaded.

## Uninstall

> [!WARNING]
> This deletes the store with every Effort, issue and Token holder, and cannot be undone. To keep a copy, take a Snapshot on the admin page first and copy it out: `docker compose cp chartroom:/data/backups/<name>.sqlite .`

In the folder holding `compose.yaml`:

```sh
docker compose down --volumes --rmi all
cd .. && rm -r my-chartroom
```

`down --volumes --rmi all` removes the container, its network, the `chartroom-data` volume and the image; leave out `--rmi all` while another Instance on the host runs the same image. Deleting the folder removes `compose.yaml` and `.env` with the passwords. If the folder is already gone, `docker ps -a` and `docker volume ls` show what is left; remove it with `docker rm -f <container>` and `docker volume rm <folder>_chartroom-data`.

Then, outside the Instance:

- Drop the site block from the reverse proxy and reload it.
- In each project repo, delete the Adapter files written by `adapter --write` and unset `CHARTROOM_URL` and `CHARTROOM_TOKEN` wherever you exported them.
- `npm uninstall -g chartroom-cli` if you installed the CLI globally.
