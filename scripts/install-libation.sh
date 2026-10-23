#!/bin/sh
set -eu

# The upstream Linux package includes its .NET runtime. Extract it
# without running desktop package scripts (which alter host sysctl settings).
metadata=$(mktemp /tmp/libation-release.XXXXXX.json)
archive=$(mktemp /tmp/libation.XXXXXX.deb)
trap 'rm -f "$archive" "$metadata"' EXIT
node /tmp/resolve-libation-release.ts "$(dpkg --print-architecture)" > "$metadata"
version=$(node -p 'require(process.argv[1]).version' "$metadata")
checksum=$(node -p 'require(process.argv[1]).sha256' "$metadata")
url=$(node -p 'require(process.argv[1]).url' "$metadata")
if [ -n "${LIBATION_RELEASE_SHA256:-}" ] && [ "$checksum" != "$LIBATION_RELEASE_SHA256" ]; then
  echo "Latest Libation release changed during build; retry the build" >&2
  exit 1
fi
curl --fail --location --retry 3 "$url" -o "$archive"
printf '%s  %s\n' "$checksum" "$archive" | sha256sum --check --strict
dpkg-deb --extract "$archive" /
ln -s /usr/lib/libation/LibationCli /usr/local/bin/libationcli
mkdir -p /usr/local/share/books
printf '%s\n' "$version" > /usr/local/share/books/libation-version
