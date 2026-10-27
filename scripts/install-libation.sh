#!/bin/sh
set -eu

# Extract the package without running desktop installation scripts.
url="${1:-}"
if [ -z "$url" ]; then
  url=$(node /tmp/resolve-libation-release.ts "$(dpkg --print-architecture)" --url)
fi
archive=$(mktemp /tmp/libation.XXXXXX.deb)
trap 'rm -f "$archive"' EXIT
curl --fail --location --retry 3 "$url" -o "$archive"
dpkg-deb --extract "$archive" /
ln -s /usr/lib/libation/LibationCli /usr/local/bin/libationcli
