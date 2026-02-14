#!/bin/bash
set -euo pipefail

# Agento Self-Hosted Installer
# https://agento.host
#
# Usage: curl -fsSL https://get.agento.host | bash

AGENTO_DIR="${AGENTO_DATA_DIR:-$HOME/.agento}"
AGENTO_VERSION="${AGENTO_VERSION:-master}"
AGENTO_REPO="https://github.com/remsyshq/agento-self-hosted.git"

# ── Colors ───────────────────────────────────────────────────────────────────

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m'

info()  { echo -e "${BLUE}[info]${NC}  $*"; }
ok()    { echo -e "${GREEN}[ok]${NC}    $*"; }
warn()  { echo -e "${YELLOW}[warn]${NC}  $*"; }
error() { echo -e "${RED}[error]${NC} $*" >&2; }
fatal() { error "$*"; exit 1; }

# ── Detect OS and Architecture ───────────────────────────────────────────────

detect_platform() {
  OS="$(uname -s)"
  ARCH="$(uname -m)"

  case "$OS" in
    Darwin) OS="macos" ;;
    Linux)  OS="linux" ;;
    *)      fatal "Unsupported OS: $OS" ;;
  esac

  case "$ARCH" in
    arm64|aarch64) ARCH="arm64" ;;
    x86_64|amd64)  ARCH="amd64" ;;
    *)             fatal "Unsupported architecture: $ARCH" ;;
  esac

  info "Detected: $OS/$ARCH"
}

# ── Check Prerequisites ─────────────────────────────────────────────────────

check_prereqs() {
  info "Checking prerequisites..."

  # Docker
  if ! command -v docker &>/dev/null; then
    fatal "Docker is not installed. Install Docker Desktop: https://docker.com/products/docker-desktop"
  fi
  if ! docker info &>/dev/null; then
    fatal "Docker is not running. Start Docker Desktop and try again."
  fi
  ok "Docker is running"

  # Node.js
  if ! command -v node &>/dev/null; then
    fatal "Node.js is not installed. Install Node.js 20+: https://nodejs.org"
  fi
  NODE_VERSION=$(node --version | sed 's/v//' | cut -d. -f1)
  if [ "$NODE_VERSION" -lt 20 ]; then
    fatal "Node.js 20+ required (found v$NODE_VERSION)"
  fi
  ok "Node.js $(node --version)"

  # npm
  if ! command -v npm &>/dev/null; then
    fatal "npm is not installed."
  fi
  ok "npm $(npm --version)"

  # git
  if ! command -v git &>/dev/null; then
    fatal "git is not installed."
  fi
  ok "git available"
}

# ── Install ──────────────────────────────────────────────────────────────────

install_agento() {
  echo
  info "Installing Agento to $AGENTO_DIR..."

  # Create data directory
  mkdir -p "$AGENTO_DIR"

  # Clone or update repo
  INSTALL_DIR="$AGENTO_DIR/app"
  if [ -d "$INSTALL_DIR/.git" ]; then
    info "Updating existing installation..."
    cd "$INSTALL_DIR"
    git pull origin "$AGENTO_VERSION" --quiet
  else
    info "Downloading Agento..."
    git clone --depth 1 --branch "$AGENTO_VERSION" "$AGENTO_REPO" "$INSTALL_DIR" 2>/dev/null || \
      git clone --depth 1 "$AGENTO_REPO" "$INSTALL_DIR"
  fi

  cd "$INSTALL_DIR"

  # Install backend dependencies (need scripts for better-sqlite3 native build)
  info "Installing backend dependencies..."
  npm install 2>/dev/null

  # Build backend
  info "Building backend..."
  npx tsc 2>/dev/null || true

  # Install frontend dependencies
  info "Installing frontend dependencies..."
  cd app
  npm install 2>/dev/null
  cd ..

  ok "Dependencies installed"
}

# ── Create CLI symlink ───────────────────────────────────────────────────────

setup_cli() {
  info "Setting up CLI..."

  INSTALL_DIR="$AGENTO_DIR/app"

  # Create wrapper script
  WRAPPER="$AGENTO_DIR/bin/agento"
  mkdir -p "$AGENTO_DIR/bin"

  cat > "$WRAPPER" << SCRIPT
#!/bin/bash
exec node --import tsx "$INSTALL_DIR/src/cli.ts" "\$@"
SCRIPT

  chmod +x "$WRAPPER"

  # Symlink to /usr/local/bin
  if [ -w /usr/local/bin ]; then
    ln -sf "$WRAPPER" /usr/local/bin/agento
    ok "CLI installed: agento"
  else
    warn "Cannot write to /usr/local/bin. Run with sudo or add $AGENTO_DIR/bin to PATH."
    info "  export PATH=\"$AGENTO_DIR/bin:\$PATH\""
  fi
}

# ── Main ─────────────────────────────────────────────────────────────────────

main() {
  echo
  echo -e "${BLUE}  Agento Self-Hosted Installer${NC}"
  echo -e "  https://agento.host"
  echo

  detect_platform
  check_prereqs
  install_agento
  setup_cli

  echo
  echo -e "${GREEN}  Agento installed successfully!${NC}"
  echo
  echo "  Next steps:"
  echo "    1. agento init       # Set up admin account"
  echo "    2. agento start      # Start the platform"
  echo "    3. agento open       # Open in browser"
  echo
  echo "  Documentation: https://agento.host/docs/self-hosted"
  echo
}

main
