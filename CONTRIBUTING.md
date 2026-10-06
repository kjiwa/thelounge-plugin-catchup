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

Set the version with `npm version --no-git-tag-version <version>`, add a
`## <version>` section to `CHANGELOG.md`, and open a PR. Release tooling lands
separately.

## Scope

The plugin does on-demand catch-up in the requesting user's own client and
stores nothing. PRs that store per-person profiles, geolocate users, or add a
provider other than through an AI SDK package are declined. Bug reports and
fixes are welcome.
