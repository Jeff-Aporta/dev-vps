#!/bin/sh
# install.sh — reproduce un VPS Ubuntu limpio para el ecosistema (Deno + dev-vps + perfil).
#
#   sh install.sh            # raíz + Deno + dev-vps + perfil DSH
#   DENO_VERSION=2.9.7 sh install.sh
#
# Idempotente. NO pisa secrets.json/env.json existentes. No instala los sistemas (erp/usrs/admn):
# esos se clonan con git y se despliegan con deploy-pull (el código nunca viaja por SFTP).
set -eu

DENO_VERSION="${DENO_VERSION:-2.9.7}"
WORK=/opt/dsh/work

[ "$(id -u)" = 0 ] || { echo "✗ correr como root"; exit 1; }

echo "· paquetes base"
need=""
for p in git curl unzip sqlite3 openssl ca-certificates; do command -v "$p" >/dev/null || need="$need $p"; done
[ -z "$need" ] || { apt-get update -qq && apt-get install -y -qq $need; }

echo "· deno $DENO_VERSION"
if ! deno --version 2>/dev/null | grep -q "^deno $DENO_VERSION "; then
  tmp=$(mktemp -d)
  curl -fsSL -o "$tmp/deno.zip" "https://github.com/denoland/deno/releases/download/v$DENO_VERSION/deno-x86_64-unknown-linux-gnu.zip"
  unzip -oq "$tmp/deno.zip" -d /usr/local/bin && chmod 755 /usr/local/bin/deno && rm -rf "$tmp"
fi
deno --version | head -1

echo "· dev-vps (tools + perfil + estándar)"
mkdir -p "$WORK"
if [ -d "$WORK/dev-vps/.git" ]; then
  git -C "$WORK/dev-vps" pull -q --ff-only || true
else
  git clone -q https://github.com/Jeff-Aporta/dev-vps "$WORK/dev-vps"
fi

echo "· perfil DSH dev-vps"
mkdir -p /root/.dsh/profiles/dev-vps
cp "$WORK/dev-vps/profile/cordis.patch.yml" /root/.dsh/profiles/dev-vps/cordis.patch.yml
cp "$WORK/dev-vps/profile/package.json" /root/.dsh/profiles/dev-vps/package.json 2>/dev/null || true

echo "· secrets.json (solo si no existe)"
[ -f "$WORK/secrets.json" ] || echo "  falta $WORK/secrets.json: súbelo con sftp-secrets"

echo "✓ VPS listo. Prueba: dsh --profile dev-vps \"echo VPS-DSH-OK\""
