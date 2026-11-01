#!/bin/sh
set -eu

# Maintenance needs Typia's compiler, but not the private lint package or native install scripts.
manifest=$(mktemp)
cp package.json "$manifest"
trap 'cp "$manifest" package.json; rm -f "$manifest"' EXIT
npm pkg delete 'devDependencies.@chris-shaw-2011/lint'
npm ci --include=dev --ignore-scripts --no-audit --no-fund
