#!/bin/sh
# Fails when the files `npm pack` would ship differ from scripts/pack-allowlist.txt.
set -eu

main() {
  _main_root=$(CDPATH='' cd -- "$(dirname -- "$0")/.." && pwd)
  _main_actual=$(mktemp)
  trap 'rm -f "$_main_actual"' EXIT
  cd "$_main_root"
  npm pack --dry-run --json |
    node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{for(const f of JSON.parse(s)[0].files)console.log(f.path)})' |
    LC_ALL=C sort >"$_main_actual"
  LC_ALL=C sort scripts/pack-allowlist.txt | diff -u - "$_main_actual"
}

main "$@"
