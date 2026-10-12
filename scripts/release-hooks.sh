# shellcheck shell=sh
# Sourced by `gh cut`; see https://github.com/kjiwa/gh-cut.

release_version() {
  node -p "require('./package.json').version"
}

release_bump() {
  npm version "$1" --no-git-tag-version >/dev/null
}

release_checks() {
  npm test
  npm run lint
  npm run format:check
}
