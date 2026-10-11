#!/usr/bin/env bash
# Copies the code to the server and (re)starts the app there. Run it again after every code change.
#
#   bash deploy/aws-deploy.sh [domain]
#
# domain: a name you own whose A record points at the server's Elastic IP. Without it the free <ip>.sslip.io name is used.
# The first run also creates the server's .env with fresh random secrets; later runs keep it.
set -euo pipefail
cd "$(dirname "$0")/.."

SECRETS=deploy/.secrets
[ -f "$SECRETS/server.json" ] || { echo "run deploy/aws-provision.sh first"; exit 1; }
json() { node -e "console.log(JSON.parse(require('fs').readFileSync('$SECRETS/server.json','utf8'))['$1'])"; }
IP=$(json ip)
DOMAIN="${1:-${IP//./-}.sslip.io}"
KEY="$SECRETS/avshesh-key.pem"
SSH=(ssh -i "$KEY" -o StrictHostKeyChecking=accept-new -o ServerAliveInterval=30 "ec2-user@$IP")

echo "== waiting for the server to finish its first setup"
for i in $(seq 1 60); do
  "${SSH[@]}" 'test -f /var/lib/avshesh-setup-done' 2>/dev/null && break
  sleep 5
done
"${SSH[@]}" 'test -f /var/lib/avshesh-setup-done' || { echo "the server is not ready yet, try again in a minute"; exit 1; }

echo "== packing the code (no secrets, no build output)"
tar czf /tmp/avshesh.tgz \
  --exclude='.git' --exclude='node_modules' --exclude='dist' --exclude='target' --exclude='uploads' --exclude='backups' \
  --exclude='deploy/.secrets' --exclude='.env' --exclude='tests/e2e/screenshots' --exclude='*.pem' .
scp -i "$KEY" -o StrictHostKeyChecking=accept-new /tmp/avshesh.tgz "ec2-user@$IP:/home/ec2-user/avshesh.tgz"
rm -f /tmp/avshesh.tgz

echo "== starting the app on $DOMAIN (the first build takes several minutes)"
"${SSH[@]}" bash -s "$DOMAIN" <<'REMOTE'
set -euo pipefail
DOMAIN="$1"
mkdir -p ~/avshesh && cd ~/avshesh
tar xzf ~/avshesh.tgz
cd deploy
if [ ! -f .env ]; then
  cp .env.prod.example .env
  sed -i "s|^POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=$(openssl rand -hex 24)|; s|^JWT_SECRET=.*|JWT_SECRET=$(openssl rand -hex 32)|" .env
fi
sed -i "s|^DOMAIN=.*|DOMAIN=$DOMAIN|" .env
docker compose -f docker-compose.prod.yml --env-file .env up -d --build
# nightly database backup, kept for 7 days
mkdir -p ~/backups
command -v crontab >/dev/null || { sudo dnf install -y cronie >/dev/null; sudo systemctl enable --now crond; }
( crontab -l 2>/dev/null | grep -v avshesh-backup; echo "30 2 * * * cd ~/avshesh/deploy && docker compose -f docker-compose.prod.yml exec -T db pg_dump -U avshesh --format=custom avshesh > ~/backups/avshesh-\$(date +\\%Y\\%m\\%d).dump && find ~/backups -name 'avshesh-*.dump' -mtime +7 -delete # avshesh-backup" ) | crontab -
REMOTE

echo "== waiting for the app"
for i in $(seq 1 90); do
  curl -s -m 5 "https://$DOMAIN/api/v1/health" | grep -q UP && { echo; echo "UP: https://$DOMAIN"; exit 0; }
  sleep 5
done
echo "the app did not answer in time: check with  ssh -i $KEY ec2-user@$IP 'cd avshesh/deploy && docker compose -f docker-compose.prod.yml logs --tail 50'"
exit 1
