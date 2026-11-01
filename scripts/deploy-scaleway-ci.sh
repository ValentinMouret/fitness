#!/usr/bin/env bash
# Build the gated main revision and release it over the Cloudflare tunnel's SSH.
set -euo pipefail
sha=${GITHUB_SHA:?}
host=${SCALEWAY_DEPLOY_HOST:?}
cd "$(git rev-parse --show-toplevel)"

# A delayed or rerun workflow must never replace a newer main revision.
superseded() { [[ $(gh api "repos/$GITHUB_REPOSITORY/commits/main" --jq .sha) != "$sha" ]]; }
if superseded; then echo 'Superseded on main; skipped.'; exit 0; fi

docker build --platform linux/amd64 --build-arg "GIT_SHA=$sha" -t "fitness:$sha" .

umask 077
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
curl -fsSL --retry 3 -o "$work/cloudflared" \
  https://github.com/cloudflare/cloudflared/releases/download/2026.10.7/cloudflared-linux-amd64
echo "1f99fb518b83dec2ba8d870a7cc991d82a77e6196295a3d2754ba17ab9f91872  $work/cloudflared" | sha256sum --check --status
chmod 700 "$work/cloudflared"
printf '%s\n' "${SCALEWAY_DEPLOY_SSH_KEY:?}" > "$work/key"
printf '%s\n' "${SCALEWAY_DEPLOY_KNOWN_HOSTS:?}" > "$work/known_hosts"
remote() {
  ssh -F /dev/null -i "$work/key" -o BatchMode=yes -o IdentitiesOnly=yes \
    -o StrictHostKeyChecking=yes -o "UserKnownHostsFile=$work/known_hosts" \
    -o ServerAliveInterval=15 -o "ProxyCommand=$work/cloudflared access ssh --hostname %h" \
    "fitness-deploy@$host" "$@"
}

docker save "fitness:$sha" | gzip | remote 'gzip -d | docker load'
if superseded; then echo 'Superseded during the build; skipped.'; exit 0; fi
tar -C deploy/scaleway -cf - compose.yaml compose.sh release.sh backup.sh provision-runtime.ts | remote 'tar -xf - -C /srv/fitness'
remote "/srv/fitness/release.sh $sha"
echo "Deployed \`$sha\` on Scaleway." >> "$GITHUB_STEP_SUMMARY"
