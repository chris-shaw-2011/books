#!/usr/bin/env bash
set -euo pipefail

version="$(jq -r .version package.json)"
[[ "$version" =~ ^[0-9]+\.[0-9]+\.[0-9]+(\.[0-9]+)?$ ]] || { echo "Invalid package version: $version"; exit 1; }
commit="$(git rev-parse HEAD)"
previous=""
if git show-ref --verify --quiet refs/tags/latest; then
  previous="$(git show refs/tags/latest:package.json | jq -r .version)"
fi
changed=false
if [ "$version" != "$previous" ]; then
  changed=true
fi

# --check reports the decision so workflows can visibly skip the tagging step.
if [ "$changed" = true ] && [ "${1:-}" != --check ]; then
  # Git itself rejects an existing version tag; only latest is allowed to move.
  git tag "$version" "$commit"
  git tag --force latest "$commit"
  git push --atomic origin "refs/tags/${version}" +refs/tags/latest
fi
{
  echo "changed=${changed}"
  echo "version=${version}"
} >> "$GITHUB_OUTPUT"

if [ "${1:-}" = --check ]; then
  build_version="$version"
  if [ "$changed" = true ]; then
    release_name="Release $version — new application version"
    message="New version detected; tagging and container publication requested."
  elif [ "${GITHUB_EVENT_NAME:-}" = workflow_dispatch ]; then
    release_name="Rebuild $version — keep existing application tag"
    message="Using the existing application tag; container build and publication requested."
  else
    build_version=""
    release_name="Release container — skipped, version $version unchanged"
    message="Version unchanged. Tag creation and container publishing are skipped."
  fi
  {
    echo "build-version=$build_version"
    echo "release-name=$release_name"
  } >> "$GITHUB_OUTPUT"
  printf '## %s\n\n%s\n' "$release_name" "$message" >> "$GITHUB_STEP_SUMMARY"
fi
