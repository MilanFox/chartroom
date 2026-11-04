# Releasing

A tag is the release. There is no cadence: a human cuts it, or the agent on an explicit request. Tagging is a push, so it follows the same rule as any push.

## Cut a release

1. On a branch `chore/release-<X.Y.Z>` from `main`, set the version in both manifests and the lockfile:

   ```sh
   npm version <X.Y.Z> --no-git-tag-version --workspaces --include-workspace-root
   node scripts/check-version.ts v<X.Y.Z>
   ```

2. Pin `<X.Y.Z>` as the image tag in `compose.example.yaml`.
3. Run `npm test`; the gate runs the same suite against the new version.
4. Commit it as `chore: release <X.Y.Z>`, open a PR and merge it. `main` only takes merged PRs.
5. Tag the merge commit and push the tag:

   ```sh
   git switch main && git pull
   git tag v<X.Y.Z>
   git push origin v<X.Y.Z>
   ```

The `Release` workflow (`.github/workflows/release.yml`) runs on `v*` tags only; no push or pull request builds anything.

## What the workflow does

| Step | Fails when |
| --- | --- |
| Version check: the tag without `v` equals `package.json` and `cli/package.json` | the tag is not `vX.Y.Z` or a manifest disagrees; runs before anything is built or published |
| Gate: `npm ci`, lint, typecheck, tests | any of them fails |
| Smoke: build the amd64 image, start it, read `GET /health` | `version` differs from the tag |
| Image: build `linux/amd64` and `linux/arm64`, push to `ghcr.io/milanfox/chartroom` | |
| npm: build and publish `chartroom-cli` from `cli/` through trusted publishing, with provenance | skipped when the version is already on npm |
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
| npm package name | `chartroom-cli`: npm rejects `chartroom` as too similar to the existing `chart-room`. The binaries stay `chartroom` and `chart`; `chartroom-cli` is a third bin so `npx -y chartroom-cli@<major>` finds one |
| npm Trusted Publisher | `chartroom-cli` package settings on npmjs.com: GitHub Actions, `MilanFox/chartroom`, workflow `release.yml`, no environment, "Allow npm publish" on, "Allow npm dist-tag" off; no token is stored |
| GHCR package visibility | public, linked to `MilanFox/chartroom`; the image label `org.opencontainers.image.source` links it on the first push |

Turning "Allow npm publish" off makes npm accept only staged versions that a maintainer approves with 2FA; the publish step then has to use `npm stage publish`.

## Check a release

```sh
gh run list --workflow release.yml --limit 1
gh release view v<X.Y.Z>
npm view chartroom-cli version
tok=$(curl -s "https://ghcr.io/token?scope=repository:milanfox/chartroom:pull" | sed -E 's/.*"token":"([^"]+)".*/\1/')
curl -s -H "Authorization: Bearer $tok" -H "Accept: application/vnd.oci.image.index.v1+json" \
  https://ghcr.io/v2/milanfox/chartroom/manifests/<X.Y.Z> | grep -oE '"architecture": *"[^"]*"'
```

The last command pulls anonymously and lists `amd64` and `arm64`; the two `unknown` entries are build attestations.

## A publish nobody cut

| Signal | Where |
| --- | --- |
| npm publish email | every maintainer gets one per published version |
| Provenance | the version page on npmjs.com names the repository, workflow and commit; a version without it did not come from `release.yml` |
| Workflow run | a `Release` run in Actions for a tag nobody pushed |

Response: remove the Trusted Publisher in the npm package settings, `npm deprecate chartroom-cli@<X.Y.Z> "<reason>"`, delete the tag and the GitHub Release, then find how the tag got pushed.

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
