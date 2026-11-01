#!/usr/bin/env bash
set -euo pipefail
host=${1:?Usage: upload-release.sh <SSH-host> [git-commit]}
[[ $host != -* ]] || exit 1
cd "$(git rev-parse --show-toplevel)"
sha=$(git rev-parse --verify "${2:-HEAD}^{commit}")
image="fitness:$sha"
context=$(mktemp -d)
trap 'rm -rf "$context"' EXIT
git archive "$sha" | tar -x -C "$context"
docker build --platform linux/amd64 --build-arg "GIT_SHA=$sha" -t "$image" "$context"
# No registry fees or credentials; use the host key verified during provisioning.
docker save "$image" | gzip | ssh "$host" 'gzip -d | docker load'
printf 'Image uploaded. On the server run: /srv/fitness/release.sh %s\n' "$image"
