# Operating an Instance

One Instance is one container, one volume and two passwords. The image serves the UI and the API on port 3000 and keeps its store in `/data`.

## Run in minutes

1. Copy `compose.example.yaml` to `compose.yaml` and `.env.example` to `.env` in an empty directory.
2. Fill `CHARTROOM_ADMIN_PASSWORD` and `CHARTROOM_VIEWER_PASSWORD` in `.env`.
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

The Instance never deletes a Snapshot; prune `/data/backups/` by hand when it grows.

## Upgrade

1. Change the image tag in `compose.yaml` to the new version. Pin a version, never `latest`.
2. `docker compose pull`
3. `docker compose up -d`

Migrations are cumulative, so any version jumps straight to any newer one; downtime is the restart. Before migrating, the Instance takes a pre-migrate Snapshot in `/data/backups/`, named `pre-migrate-<old schema>-to-<new version>-<timestamp>.sqlite`, and logs its path. If the Snapshot fails, the boot aborts and nothing is migrated.

## Rollback

Migrations are forward-only, so rollback restores the pre-migrate Snapshot. Started on an older image without the swap, the container exits and names the Snapshot to restore.

The swap runs in a throwaway container from the same image, so the files stay owned by `node`. Compose prefixes the volume with the project name, by default the directory holding `compose.yaml`; `docker volume ls` shows it. With project `chartroom`:

```sh
docker compose stop
docker run --rm -v chartroom_chartroom-data:/data ghcr.io/milanfox/chartroom:<previous> ls /data/backups
docker run --rm -v chartroom_chartroom-data:/data ghcr.io/milanfox/chartroom:<previous> sh -c '
  cp /data/backups/<pre-migrate snapshot>.sqlite /data/chartroom.sqlite &&
  rm -f /data/chartroom.sqlite-wal /data/chartroom.sqlite-shm'
```

Then pin `<previous>` in `compose.yaml` and `docker compose up -d`.

Guarantee: you never lose the state you had before the upgrade; you may lose what was written after it.

Restoring any other Snapshot is the same swap with its file name.

## First run

The first boot creates nothing but the seeded Label groups: no Token holder, no token in the environment. Until the first Token holder exists the API answers every bearer call with `unauthenticated`.

1. Open the Instance and log in with the viewer password.
2. Elevate with the admin password.
3. Follow the setup checklist on the admin page: name the project, pick the Effort's Display label, add Environments, create the first Token holder. Its secret is shown once.
4. In the project repo, with `CHARTROOM_URL` and `CHARTROOM_TOKEN` set to the Instance URL and that secret:

   ```sh
   npx -y chartroom@<major> adapter --write docs/agents
   ```

   `<major>` is the Instance's major version, `0` while it is `0.x`. Re-run it after changing settings.
