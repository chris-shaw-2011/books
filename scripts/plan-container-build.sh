#!/usr/bin/env bash
set -euo pipefail

reasons=()
if [ "$RELEASE_REQUESTED" = true ]; then
  reasons+=("application release $RELEASE_VERSION requested")
fi
if [ "$PREVIOUS_FOUND" = true ]; then
  if [ "$PREVIOUS_BASE_DIGEST" != "$CURRENT_BASE_DIGEST" ]; then
    reasons+=("Node base image updated")
  fi
  if [ "$PREVIOUS_LIBATION_SHA256" != "$CURRENT_LIBATION_SHA256" ]; then
    reasons+=("Libation $CURRENT_LIBATION_VERSION available")
  fi
  if [ "$APT_UPGRADE_COUNT" != 0 ]; then
    reasons+=("$APT_UPGRADE_COUNT Debian package upgrades")
  fi
fi

should_build=false
target_version=""
publish_name="Publish container — skipped, no updates"
reason="No updates — keep $PREVIOUS_VERSION"
if [ "${#reasons[@]}" -gt 0 ]; then
  should_build=true
  reason="${reasons[0]}"
  for change in "${reasons[@]:1}"; do
    reason+="; $change"
  done
fi

if [ "$should_build" = true ]; then
  prefix="$RELEASE_VERSION"
  if [[ "$prefix" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    prefix="${prefix}.0"
  fi
  escaped_prefix="${prefix//./\\.}"
  revision=0
  if [[ "$PREVIOUS_VERSION" =~ ^${escaped_prefix}\.([0-9]+)$ ]]; then
    revision=$((10#${BASH_REMATCH[1]} + 1))
  fi
  target_version="${prefix}.${revision}"
  publish_name="Publish $target_version — $reason"
fi

echo "Decision result:"
echo "  should_build=${should_build}"
echo "  target_version=${target_version}"
echo "  reason=${reason}"

{
  echo "target-version=${target_version}"
  echo "publish-name=${publish_name}"
} >> "$GITHUB_OUTPUT"

{
  if [ "$should_build" = true ]; then
    echo "## Container build requested: $target_version"
    echo
    for change in "${reasons[@]}"; do
      echo "- $change"
    done
  else
    echo "## No container build — no runtime updates"
    echo
    echo "Keeping **$PREVIOUS_VERSION**. Build, runtime verification and publishing are skipped."
  fi
  echo
  echo "| Component | Published image | Requested |"
  echo "| --- | --- | --- |"
  echo "| Application | ${PREVIOUS_RELEASE_VERSION:-none} | $RELEASE_VERSION |"
  echo "| Node base | ${PREVIOUS_BASE_DIGEST:0:19} | ${CURRENT_BASE_DIGEST:0:19} |"
  echo "| Libation package | ${PREVIOUS_LIBATION_SHA256:0:12} | $CURRENT_LIBATION_VERSION (${CURRENT_LIBATION_SHA256:0:12}) |"
  if [ "$APT_CHECKED" = success ]; then
    echo "| Debian packages | $APT_UPGRADE_COUNT upgrades available | Refresh on build |"
  else
    echo "| Debian packages | Check skipped — another change already requires a build | Refresh on build |"
  fi
} >> "$GITHUB_STEP_SUMMARY"
echo "::notice title=Container decision::$reason"
