#!/usr/bin/env bash
# Exercise the real backup function with the production Compose security policy.
set -euo pipefail
repo=$(cd "$(dirname "$0")/.." && pwd)
ROOT=$(mktemp -d)
APP="$ROOT/app"
PROJECT="vpsbot-backup-test-$$"
mkdir -p "$APP/deploy/vps"
cp "$repo/deploy/vps/compose.yaml" "$APP/deploy/vps/compose.yaml"
printf 'DOMAIN=example.com\nADMIN_TOKEN=backup-test-only-at-least-32-characters\n' > "$APP/deploy/vps/.env"
git -C "$APP" init -q
git -C "$APP" -c user.name=Test -c user.email=test@example.com commit -q --allow-empty -m fixture
compose(){ docker compose -p "$PROJECT" -f "$APP/deploy/vps/compose.yaml" "$@"; }
cleanup(){ compose down --volumes --remove-orphans || true; rm -rf "$ROOT"; }
trap cleanup EXIT
source <(sed -n '/^backup(){/,/^}$/p' "$repo/deploy/vps/manage.sh")
compose run --rm --no-deps --entrypoint node panel -e 'const fs=require("fs"); fs.writeFileSync("/data/backup-fixture", "private-data", {mode:0o600}); if ((fs.statSync("/data").mode & 0o777) !== 0o700) process.exit(1)'
compose up -d --no-build --no-deps panel
backup
archive=$(find "$ROOT/backups" -name data.tar.gz -print -quit)
test "$(tar -xOzf "$archive" ./backup-fixture)" = private-data
cmp "$APP/deploy/vps/.env" "$(dirname "$archive")/panel.env"
test -s "$(dirname "$archive")/commit.txt"
for attempt in $(seq 1 30); do
 if compose exec -T panel node -e "fetch('http://127.0.0.1:3000/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"; then
  echo 'Backup archive verified; panel resumed with protected data permissions.'
  exit 0
 fi
 sleep 2
done
echo 'Panel did not resume after backup' >&2
exit 1
