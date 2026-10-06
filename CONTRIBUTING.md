# Contributing

## Setup and checks

```sh
npm ci
npm test
npx eslint .
npx prettier --check .
```

CI runs these on Node 22.17, the supported minimum, and 24.

`npm run test:e2e` starts a pinned TheLounge on a fixture home with the packed
tarball installed under `packages/`. Run it when a change touches the plugin
entry point, its packaging, or `test/e2e/`. Fixtures are synthetic; never
commit real channel logs.

`scripts/pack-allowlist.txt` lists the files `npm pack` must ship. CI fails when
the pack contents differ; update the list in the same change that adds or
removes a shipped file.

## Releasing

Add a `## <version>` section to `CHANGELOG.md` in a PR and merge it, then run
from a clean, up-to-date `main`:

```sh
sh scripts/release.sh [--dry-run] <version>
```

The script bumps `package.json` and `package-lock.json` through a squash-merged
PR, waits for checks, tags the merge commit, and creates the GitHub release with
the matching CHANGELOG section as its notes. Publishing the release triggers
`.github/workflows/publish.yml`, which verifies the tag and runs
`npm publish` through npm trusted publishing (no token).

Trusted publishing can only be configured on a package that exists. Publish the
first version by hand with `npm publish` from a clean checkout of its tag, then
on npmjs.com add a trusted publisher for this repository with workflow filename
`publish.yml`. Later releases need no credentials.

## Scope

The plugin does on-demand catch-up in the requesting user's own client and
stores nothing. PRs that store per-person profiles, geolocate users, or add a
provider other than through an AI SDK package are declined. Bug reports and
fixes are welcome.
