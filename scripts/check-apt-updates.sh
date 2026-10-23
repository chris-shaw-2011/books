#!/bin/sh
set -eu

plan=$(mktemp)
trap 'rm -f "$plan"' 0

apt-get update -qq
apt-get -s upgrade > "$plan"
awk '$1 == "Inst" { count++ } END { print count+0 }' "$plan"
