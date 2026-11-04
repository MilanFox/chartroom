# Releasing

A tag is the release. There is no cadence: a human cuts it, or the agent on an explicit request. Tagging is a push, so it follows the same rule as any push.

## Cut a release

1. On `main`, set the version in both manifests and the lockfile:

   ```sh
   npm version <X.Y.Z> --no-git-tag-version --workspaces --include-workspace-root
   node scripts/check-version.ts v<X.Y.Z>
   ```

2. Pin `<X.Y.Z>` as the image tag in `compose.example.yaml`.
3. Commit it: `chore: release <X.Y.Z>`.
4. Tag and push:

   ```sh
   git tag v<X.Y.Z>
   git push origin main v<X.Y.Z>
   ```

The `Release` workflow (`.github/workflows/release.yml`) runs on `v*` tags only; no push or pull request builds anything.

## What the workflow does

| Step | Fails when |
| --- | --- |
| Version check: the tag without `v` equals `package.json` and `cli/package.json` | the tag is not `vX.Y.Z` or a manifest disagrees; runs before anything is built or published |
| Gate: `npm ci`, lint, typecheck, tests | any of them fails |
| Smoke: build the amd64 image, start it, read `GET /health` | `version` differs from the tag |
| Image: build `linux/amd64` and `linux/arm64`, push to `ghcr.io/milanfox/chartroom` | |
| npm: build and publish `chartroom` from `cli/` with provenance | |
| GitHub Release: notes from `scripts/release-notes.ts` | |

One tag, one number: `vX.Y.Z` becomes the image tags `X.Y.Z`, `X.Y` and `X`, the npm version and the version `GET /health` reports. The server reads it from `package.json` at build time.

Release notes group the conventional commits since the previous `v*` tag, merges skipped:

| Section | Commits |
| --- | --- |
| Breaking changes | any type with `!` before the colon (also listed under its type) |
| Features | `feat:` |
| Fixes | `fix:` |
| Other changes | every other type and non-conventional subjects |

Preview them before tagging: `node scripts/release-notes.ts HEAD`.

## Repository setup

| What | Where |
| --- | --- |
| `NPM_TOKEN` | Actions secret: an npm automation token allowed to publish `chartroom` |
| GHCR package visibility | public, linked to `MilanFox/chartroom`; the image label `org.opencontainers.image.source` links it on the first push |

## Versioning

| Version | Rule |
| --- | --- |
| `0.x` | while the tracker is built, until the spec is implemented and dogfooded |
| `1.0.0` | the spec implemented and dogfooded |
| major, after 1.0 | a CLI or API contract was removed or changed incompatibly |
| minor | anything new that keeps every contract |
| patch | fixes only |

A schema migration alone is never a major: migrations are cumulative and any version upgrades straight to any newer one.

The CLI and the Instance carry the same number; the CLI requires only the major to match and warns on stderr otherwise.
