#!/usr/bin/env bash
set -euo pipefail

[[ ${GITHUB_ACTIONS:-} == true && ${GITHUB_EVENT_NAME:-} == push && ${GITHUB_REF:-} == refs/heads/main ]] || {
  echo 'Deployment requires a GitHub Actions push to main.' >&2
  exit 1
}
sha=${GITHUB_SHA:?Missing GITHUB_SHA}
[[ $sha =~ ^[0-9a-f]{40}$ ]] || exit 1
cd "$(git rev-parse --show-toplevel)"
[[ $(git rev-parse HEAD) == "$sha" ]] || { echo 'Checkout does not match the gated revision.' >&2; exit 1; }
for name in GH_TOKEN SCALEWAY_DEPLOY_HOST SCALEWAY_DEPLOY_SSH_KEY SCALEWAY_DEPLOY_KNOWN_HOSTS TUNNEL_SERVICE_TOKEN_ID TUNNEL_SERVICE_TOKEN_SECRET; do
  [[ -n ${!name:-} ]] || { printf 'Missing deployment setting: %s\n' "$name" >&2; exit 1; }
done
[[ $SCALEWAY_DEPLOY_HOST =~ ^[a-zA-Z0-9]([a-zA-Z0-9.-]*[a-zA-Z0-9])?$ ]] || exit 1
[[ ${GITHUB_RUN_ID:-} =~ ^[0-9]+$ && ${GITHUB_RUN_ATTEMPT:-} =~ ^[0-9]+$ ]] || exit 1

# A delayed or rerun workflow must never replace a newer main revision.
main_sha=$(gh api "repos/$GITHUB_REPOSITORY/commits/main" --jq .sha)
if [[ $main_sha != "$sha" ]]; then
  echo 'Revision was superseded on main; deployment skipped.'
  exit 0
fi

umask 077
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
mkdir "$work/context"
git archive "$sha" | tar -x -C "$work/context"
image="fitness:$sha"
docker build --platform linux/amd64 --build-arg "GIT_SHA=$sha" -t "$image" "$work/context"
[[ $(docker image inspect --format '{{.Os}}/{{.Architecture}}' "$image") == linux/amd64 ]]
docker image inspect --format '{{json .Config.Env}}' "$image" | jq -e --arg value "GIT_SHA=$sha" 'index($value) != null' >/dev/null

# Pinned official release: github.com/cloudflare/cloudflared/releases/tag/2026.10.7.
curl --fail --silent --show-error --location --retry 3 \
  https://github.com/cloudflare/cloudflared/releases/download/2026.10.7/cloudflared-linux-amd64 \
  -o "$work/cloudflared"
printf '%s  %s\n' 1f99fb518b83dec2ba8d870a7cc991d82a77e6196295a3d2754ba17ab9f91872 "$work/cloudflared" | sha256sum --check --status
chmod 700 "$work/cloudflared"
printf '%s\n' "$SCALEWAY_DEPLOY_SSH_KEY" > "$work/key"
printf '%s\n' "$SCALEWAY_DEPLOY_KNOWN_HOSTS" > "$work/known_hosts"
unset SCALEWAY_DEPLOY_SSH_KEY SCALEWAY_DEPLOY_KNOWN_HOSTS
ssh-keygen -F "$SCALEWAY_DEPLOY_HOST" -f "$work/known_hosts" >/dev/null || {
  echo 'Pinned host key must match SCALEWAY_DEPLOY_HOST.' >&2
  exit 1
}
ssh_options=(
  -F /dev/null -i "$work/key"
  -o BatchMode=yes -o IdentitiesOnly=yes -o StrictHostKeyChecking=yes
  -o "UserKnownHostsFile=$work/known_hosts" -o GlobalKnownHostsFile=/dev/null
  -o ConnectTimeout=30 -o ServerAliveInterval=15 -o ServerAliveCountMax=4
  -o "ProxyCommand=$work/cloudflared access ssh --hostname %h"
)
remote="fitness-deploy@$SCALEWAY_DEPLOY_HOST"
staging="/srv/fitness/.incoming-$sha-$GITHUB_RUN_ID-$GITHUB_RUN_ATTEMPT"
ssh "${ssh_options[@]}" "$remote" "mkdir -p '$staging' && chmod 700 '$staging'"
# Only these public release files travel to the server; its secrets stay in place.
tar -C "$work/context/deploy/scaleway" -cf - compose.yaml Caddyfile release.sh provision-runtime.ts |
  ssh "${ssh_options[@]}" "$remote" "tar -xf - -C '$staging'"
docker save "$image" | gzip | ssh "${ssh_options[@]}" "$remote" "bash -o pipefail -c 'gzip -d | docker load'"
main_sha=$(gh api "repos/$GITHUB_REPOSITORY/commits/main" --jq .sha)
if [[ $main_sha != "$sha" ]]; then
  ssh "${ssh_options[@]}" "$remote" "rm -rf '$staging'"
  echo 'Revision was superseded during the build; deployment skipped.'
  exit 0
fi
ssh "${ssh_options[@]}" "$remote" "bash -s -- '$sha' '$staging'" <<'REMOTE'
set -euo pipefail
sha=$1
staging=$2
cd /srv/fitness
install -m 644 "$staging/compose.yaml" compose.yaml
# Keep the inode referenced by the running container's single-file bind mount.
cat "$staging/Caddyfile" > Caddyfile
chmod 644 Caddyfile
install -m 755 "$staging/release.sh" release.sh
install -m 644 "$staging/provision-runtime.ts" provision-runtime.ts
./release.sh "fitness:$sha"
rm -rf "$staging"
REMOTE
ssh "${ssh_options[@]}" "$remote" 'curl --fail --silent --show-error http://127.0.0.1:5174/healthz' |
  jq -e --arg sha "$sha" '.status == "ok" and .checks.database == "ok" and .sha == $sha' >/dev/null
printf 'Deployed and verified `%s` on Scaleway.\n' "$sha" >> "$GITHUB_STEP_SUMMARY"
