#!/bin/bash
set -euo pipefail

# Agento Self-Hosted Uninstaller

AGENTO_DIR="${AGENTO_DATA_DIR:-$HOME/.agento}"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m'

info()  { echo -e "${BLUE}[info]${NC}  $*"; }
ok()    { echo -e "${GREEN}[ok]${NC}    $*"; }
warn()  { echo -e "${YELLOW}[warn]${NC}  $*"; }

echo
echo -e "${RED}  Agento Uninstaller${NC}"
echo

read -p "  This will remove Agento and all agent data. Continue? [y/N] " confirm
if [[ "$confirm" != [yY] ]]; then
  echo "  Cancelled."
  exit 0
fi

# Stop any running services
info "Stopping services..."
if command -v agento &>/dev/null; then
  agento stop 2>/dev/null || true
fi

# Stop and remove managed containers
info "Removing containers..."
docker ps -a --filter label=agento.managed=true --format '{{.ID}}' | xargs -r docker rm -f 2>/dev/null || true
ok "Containers removed"

# Remove CLI symlink
if [ -L /usr/local/bin/agento ]; then
  rm -f /usr/local/bin/agento
  ok "CLI symlink removed"
fi

# Remove data directory
if [ -d "$AGENTO_DIR" ]; then
  rm -rf "$AGENTO_DIR"
  ok "Data directory removed: $AGENTO_DIR"
fi

echo
echo -e "${GREEN}  Agento has been uninstalled.${NC}"
echo
