#!/usr/bin/env bash
set -euo pipefail

version="$(jq -r .version package.json)"
[[ "$version" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || { echo "Invalid package version: $version"; exit 1; }
previous=""
if git show-ref --verify --quiet refs/tags/latest; then
  previous="$(git show refs/tags/latest:package.json | jq -r .version)"
fi
changed=false
if [ "$version" != "$previous" ]; then
  commit="$(git rev-parse HEAD)"
  # Concurrency serializes runs but does not guarantee commit order.
  if git show-ref --verify --quiet refs/tags/latest; then
    if ! git merge-base --is-ancestor "refs/tags/latest^{commit}" "$commit"; then
      echo "latest already points beyond this commit or to another history; refusing to move it backwards."
      exit 1
    fi
  fi
  if git show-ref --verify --quiet "refs/tags/${version}"; then
    if [ "$(git rev-parse "refs/tags/${version}^{commit}")" != "$commit" ]; then
      echo "Version ${version} already identifies another commit. Bump package.json."
      exit 1
    fi
  else
    git tag "$version" "$commit"
  fi
  # Version tags are immutable; only latest moves.
  git tag --force latest "$commit"
  git push --atomic origin "refs/tags/${version}" +refs/tags/latest
  changed=true
fi
{
  echo "changed=${changed}"
  echo "version=${version}"
} >> "$GITHUB_OUTPUT"
