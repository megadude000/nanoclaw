#!/usr/bin/env bash
# Sets up Cloudflare Tunnel to expose the Notion webhook receiver.
# Run this once; it installs cloudflared and creates a persistent named tunnel.
#
# Usage:
#   ./scripts/setup-cloudflare-tunnel.sh              # interactive setup
#   ./scripts/setup-cloudflare-tunnel.sh --quick-test # temporary tunnel for testing only

set -euo pipefail

PORT="${NOTION_WEBHOOK_PORT:-3456}"
TUNNEL_NAME="nanoclaw-notion"
SERVICE_NAME="cloudflared-nanoclaw-notion"

# ─── helpers ─────────────────────────────────────────────────────────────────

log()  { echo "▶ $*"; }
ok()   { echo "✅ $*"; }
warn() { echo "⚠️  $*"; }
die()  { echo "❌ $*" >&2; exit 1; }

require() { command -v "$1" &>/dev/null || die "$1 not found — install it first."; }

# ─── install cloudflared ──────────────────────────────────────────────────────

install_cloudflared() {
  if command -v cloudflared &>/dev/null; then
    ok "cloudflared already installed: $(cloudflared --version)"
    return
  fi

  log "Installing cloudflared..."

  if [[ "$(uname -s)" != "Linux" ]]; then
    die "Auto-install only supported on Linux. Install cloudflared manually: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/"
  fi

  ARCH="$(uname -m)"
  case "$ARCH" in
    x86_64)  DEB_ARCH="amd64" ;;
    aarch64) DEB_ARCH="arm64" ;;
    *)       die "Unknown arch: $ARCH. Install cloudflared manually." ;;
  esac

  TMP="$(mktemp -d)"
  curl -fsSL \
    "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-${DEB_ARCH}.deb" \
    -o "$TMP/cloudflared.deb"
  sudo dpkg -i "$TMP/cloudflared.deb"
  rm -rf "$TMP"
  ok "cloudflared installed: $(cloudflared --version)"
}

# ─── quick test tunnel (no account needed, random URL) ───────────────────────

quick_test_tunnel() {
  warn "Starting a TEMPORARY tunnel — URL changes on restart."
  warn "Use this only to test that the webhook handler responds."
  echo ""
  log "Running: cloudflared tunnel --url http://localhost:${PORT}"
  echo ""
  echo "Copy the https://*.trycloudflare.com URL that appears below."
  echo "Register it as your Notion webhook URL."
  echo "Press Ctrl+C to stop."
  echo ""
  exec cloudflared tunnel --url "http://localhost:${PORT}"
}

# ─── persistent named tunnel (requires Cloudflare account) ───────────────────

setup_named_tunnel() {
  log "Setting up persistent named tunnel '${TUNNEL_NAME}'..."

  # Login (opens browser)
  if ! cloudflared tunnel list 2>/dev/null | grep -q "${TUNNEL_NAME}"; then
    log "Logging in to Cloudflare (browser will open)..."
    cloudflared tunnel login

    log "Creating tunnel '${TUNNEL_NAME}'..."
    cloudflared tunnel create "${TUNNEL_NAME}"
  else
    ok "Tunnel '${TUNNEL_NAME}' already exists"
  fi

  # Get tunnel UUID
  TUNNEL_UUID=$(cloudflared tunnel list --output json 2>/dev/null \
    | python3 -c "import sys,json; t=[t for t in json.load(sys.stdin) if t['name']=='${TUNNEL_NAME}']; print(t[0]['id'] if t else '')" 2>/dev/null || true)

  if [[ -z "$TUNNEL_UUID" ]]; then
    die "Could not get tunnel UUID. Run: cloudflared tunnel list"
  fi

  ok "Tunnel UUID: ${TUNNEL_UUID}"

  # Write cloudflared config
  CF_CONFIG_DIR="${HOME}/.cloudflared"
  mkdir -p "${CF_CONFIG_DIR}"

  cat > "${CF_CONFIG_DIR}/${TUNNEL_NAME}.yml" <<EOF
tunnel: ${TUNNEL_UUID}
credentials-file: ${CF_CONFIG_DIR}/${TUNNEL_UUID}.json

ingress:
  - hostname: ${TUNNEL_NAME}.cfargotunnel.com
    service: http://127.0.0.1:${PORT}
  - service: http_status:404
EOF

  ok "Config written to ${CF_CONFIG_DIR}/${TUNNEL_NAME}.yml"

  # DNS route — only works with a domain added to Cloudflare
  echo ""
  warn "To assign a stable hostname, run ONE of:"
  echo "  cloudflared tunnel route dns ${TUNNEL_NAME} notion-webhook.yourdomain.com"
  echo "  (needs your domain in Cloudflare DNS)"
  echo ""
  echo "Or use the auto-assigned tunnel URL:"
  echo "  https://${TUNNEL_UUID}.cfargotunnel.com"
  echo ""

  setup_systemd_service "${CF_CONFIG_DIR}/${TUNNEL_NAME}.yml"
}

# ─── systemd service ──────────────────────────────────────────────────────────

setup_systemd_service() {
  local config_file="$1"

  log "Setting up systemd user service '${SERVICE_NAME}'..."

  mkdir -p "${HOME}/.config/systemd/user"

  cat > "${HOME}/.config/systemd/user/${SERVICE_NAME}.service" <<EOF
[Unit]
Description=Cloudflare Tunnel — NanoClaw Notion webhook
After=network-online.target

[Service]
Type=simple
ExecStart=$(command -v cloudflared) tunnel --config ${config_file} run ${TUNNEL_NAME}
Restart=on-failure
RestartSec=5s
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=default.target
EOF

  systemctl --user daemon-reload
  systemctl --user enable "${SERVICE_NAME}"
  systemctl --user start "${SERVICE_NAME}"

  ok "Service '${SERVICE_NAME}' started"
  echo ""
  log "Check status:  systemctl --user status ${SERVICE_NAME}"
  log "View logs:     journalctl --user -u ${SERVICE_NAME} -f"
}

# ─── print next steps ─────────────────────────────────────────────────────────

print_next_steps() {
  echo ""
  echo "════════════════════════════════════════════════════════════"
  echo "  Next steps — register the webhook in Notion"
  echo "════════════════════════════════════════════════════════════"
  echo ""
  echo "1. Go to: https://www.notion.so/profile/integrations"
  echo "   Open your integration → Webhooks tab → Add webhook"
  echo ""
  echo "2. Webhook URL:"
  echo "   https://<your-tunnel-hostname>/notion-webhook"
  echo "   (replace with the URL from above)"
  echo ""
  echo "3. Select event type: comment.created"
  echo "   Optionally scope to your BP Tasks database ID"
  echo ""
  echo "4. Copy the Signing Secret and add to .env:"
  echo "   NOTION_WEBHOOK_SECRET=<paste-secret-here>"
  echo ""
  echo "5. Restart NanoClaw:"
  echo "   systemctl --user restart nanoclaw"
  echo ""
  echo "6. Post a test comment on any BP Tasks page."
  echo "   Check logs: journalctl --user -u nanoclaw -f"
  echo "════════════════════════════════════════════════════════════"
}

# ─── main ─────────────────────────────────────────────────────────────────────

install_cloudflared

if [[ "${1:-}" == "--quick-test" ]]; then
  quick_test_tunnel  # does not return
fi

setup_named_tunnel
print_next_steps
