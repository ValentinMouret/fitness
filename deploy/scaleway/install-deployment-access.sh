#!/usr/bin/env bash
set -euo pipefail
[[ $(id -u) == 0 ]] || { echo 'Run as root on the deployment host.' >&2; exit 1; }
key_file=${1:?Usage: install-deployment-access.sh public-key token-file cloudflared-binary}
token_file=${2:?Missing tunnel token file}
binary=${3:?Missing verified linux/amd64 cloudflared binary}
ssh-keygen -l -f "$key_file" >/dev/null
test -s "$token_file"
id fitness-deploy >/dev/null 2>&1 || useradd --create-home --shell /bin/bash fitness-deploy
usermod -aG docker fitness-deploy
install -d -m 700 -o fitness-deploy -g fitness-deploy /home/fitness-deploy/.ssh
{ printf 'restrict '; cat "$key_file"; } > /home/fitness-deploy/.ssh/authorized_keys
chown fitness-deploy:fitness-deploy /home/fitness-deploy/.ssh/authorized_keys
chmod 600 /home/fitness-deploy/.ssh/authorized_keys
chown -R fitness-deploy:fitness-deploy /srv/fitness
chmod 700 /srv/fitness
id cloudflared >/dev/null 2>&1 || useradd --system --no-create-home --shell /usr/sbin/nologin cloudflared
install -m 755 "$binary" /usr/local/bin/cloudflared
install -d -m 750 -o root -g cloudflared /etc/cloudflared
install -m 640 -o root -g cloudflared "$token_file" /etc/cloudflared/fitness.token
cat > /etc/systemd/system/fitness-deployment-tunnel.service <<'UNIT'
[Unit]
Description=Fitness CI deployment tunnel
After=network-online.target
Wants=network-online.target

[Service]
User=cloudflared
Group=cloudflared
ExecStart=/usr/local/bin/cloudflared tunnel --no-autoupdate --edge-ip-version 6 run --token-file /etc/cloudflared/fitness.token
Restart=on-failure
RestartSec=5
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload
systemctl enable --now fitness-deployment-tunnel
systemctl restart fitness-deployment-tunnel
