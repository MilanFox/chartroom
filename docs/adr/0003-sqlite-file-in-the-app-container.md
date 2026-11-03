# The store is one SQLite file inside the app container, no database sidecar

Chartroom runs one Docker container per project, and the store is a single SQLite file on a `/data` volume opened in WAL mode by the Nitro process, reached only through the HTTP API. One instance serves a handful of agents and humans whose writes are short rows, far below SQLite's single-writer limit, so a Postgres sidecar would add a second container, credentials, startup ordering and its own backup and upgrade story for concurrency the product never needs. The driver is better-sqlite3 behind Drizzle, so swapping to Node's built-in `node:sqlite` once Drizzle supports it on a stable line is a one-line change; swapping to Postgres is a deliberate re-decision, not a configuration.

## Considered Options

- Postgres sidecar: multi-writer and remote access, neither needed for one container per project; doubles the operational surface.
- Nitro's experimental `database`/db0 layer: untyped, no migrations, experimental.
- libsql: upstream steers new projects to a beta rewrite; only worth it for remote replicas.
- `node:sqlite` + Drizzle 1.0 rc now: no native module, but release-candidate on both sides; deferred until Drizzle 1.0 is GA.

## Consequences

- Only one process may open the file; a second app replica or a host-side tool touching the live file reintroduces locking. Backups go through `VACUUM INTO` or the backup API, never `cp` of the live file.
- The volume must be a local filesystem; WAL is unsafe over network mounts.
