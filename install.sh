#!/bin/bash
set -euo pipefail

# Agento Self-Hosted Installer
# https://agento.host
#
# Usage: curl -fsSL https://get.agento.host/install.sh | bash

AGENTO_DIR="${AGENTO_DATA_DIR:-$HOME/.agento}"
AGENTO_VERSION="${AGENTO_VERSION:-master}"
AGENTO_REPO="https://github.com/remsyshq/agento-self-hosted.git"

# ── Ensure PATH includes common tool locations ──────────────────────────────
# When piped via curl|bash, the shell is non-interactive and may not source
# .bashrc/.zshrc, so Homebrew, nvm, etc. paths can be missing.

for p in /opt/homebrew/bin /usr/local/bin /home/linuxbrew/.linuxbrew/bin; do
  [ -d "$p" ] && case ":$PATH:" in *":$p:"*) ;; *) export PATH="$p:$PATH" ;; esac
done

# Source nvm if available (common Node.js version manager)
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh" 2>/dev/null

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

  # Docker (Docker Desktop, OrbStack, or any Docker-compatible runtime)
  if ! command -v docker &>/dev/null; then
    if [ "$OS" = "macos" ] && [ "$ARCH" = "arm64" ]; then
      fatal "Docker is not installed. Install one of:\n  OrbStack (recommended): https://orbstack.dev\n  Docker Desktop:         https://docker.com/products/docker-desktop"
    else
      fatal "Docker is not installed. Install Docker Desktop: https://docker.com/products/docker-desktop"
    fi
  fi
  if ! docker info &>/dev/null; then
    # Detect which runtime is installed
    DOCKER_RUNTIME="Docker"
    if [ "$OS" = "macos" ]; then
      if [ -d "/Applications/OrbStack.app" ]; then
        DOCKER_RUNTIME="OrbStack"
      fi
    fi
    fatal "$DOCKER_RUNTIME is not running. Start $DOCKER_RUNTIME and try again."
  fi
  # Show which runtime
  DOCKER_RUNTIME="Docker"
  if [ "$OS" = "macos" ] && [ -d "/Applications/OrbStack.app" ]; then
    DOCKER_RUNTIME="OrbStack"
  fi
  ok "$DOCKER_RUNTIME is running ($(docker --version | cut -d' ' -f3 | tr -d ','))"

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

  # Build tools (needed for better-sqlite3 native addon)
  if [ "$OS" = "macos" ]; then
    if ! xcode-select -p &>/dev/null; then
      fatal "Xcode Command Line Tools not installed. Run: xcode-select --install"
    fi
    ok "Xcode CLI tools available"
  else
    if ! command -v make &>/dev/null || ! command -v g++ &>/dev/null; then
      fatal "Build tools not installed. Run: sudo apt-get install build-essential"
    fi
    ok "Build tools available"
  fi
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

  # Clean stale lockfile/modules after update (deps may have changed)
  rm -f package-lock.json
  rm -rf node_modules

  # Install backend dependencies (need scripts for better-sqlite3 native build)
  info "Installing backend dependencies..."
  npm install --no-fund --no-audit --loglevel=error || fatal "Failed to install backend dependencies"

  # Build backend
  info "Building backend..."
  npx tsc 2>&1 | tail -1 || true

  # Install frontend dependencies
  info "Installing frontend dependencies..."
  cd app
  npm install --no-fund --no-audit --loglevel=error || fatal "Failed to install frontend dependencies"
  cd ..

  ok "Dependencies installed"
}

# ── Create CLI symlink ───────────────────────────────────────────────────────

add_to_path_hint() {
  local shell_name profile_file export_line
  shell_name="$(basename "${SHELL:-/bin/bash}")"
  export_line="export PATH=\"$AGENTO_DIR/bin:\$PATH\""

  case "$shell_name" in
    zsh)  profile_file="$HOME/.zshrc" ;;
    bash)
      if [ "$OS" = "macos" ]; then
        profile_file="$HOME/.bash_profile"
      else
        profile_file="$HOME/.bashrc"
      fi
      ;;
    fish)
      export_line="fish_add_path $AGENTO_DIR/bin"
      profile_file="$HOME/.config/fish/config.fish"
      ;;
    *)    profile_file="$HOME/.profile" ;;
  esac

  warn "Could not add agento to /usr/local/bin."
  echo
  info "  Add to your $shell_name profile by running:"
  echo
  echo -e "    echo '$export_line' >> $profile_file"
  echo
  info "  Then restart your terminal or run:"
  echo
  echo -e "    source $profile_file"
  echo
}

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

  # Symlink to /usr/local/bin (try sudo if needed)
  if [ -w /usr/local/bin ]; then
    ln -sf "$WRAPPER" /usr/local/bin/agento
    ok "CLI installed: agento"
  elif command -v sudo &>/dev/null; then
    info "Need sudo to create /usr/local/bin/agento symlink..."
    if sudo ln -sf "$WRAPPER" /usr/local/bin/agento 2>/dev/null; then
      ok "CLI installed: agento"
    else
      add_to_path_hint
    fi
  else
    add_to_path_hint
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
  echo -e "${GREEN}  ✓ Agento installed successfully!${NC}"
  echo
  echo "  Next steps:"
  echo
  echo -e "    ${BLUE}agento init${NC}        Set up admin email + password"
  echo -e "    ${BLUE}agento start${NC}       Start orchestrator (:3001) + frontend (:3000)"
  echo -e "    ${BLUE}agento open${NC}        Open http://localhost:3000 in browser"
  echo
  echo "  Other commands:"
  echo
  echo -e "    ${BLUE}agento status${NC}      Show running agents + service health"
  echo -e "    ${BLUE}agento stop${NC}        Stop all services"
  echo -e "    ${BLUE}agento token${NC}       Print API token"
  echo
  echo -e "  Docs: ${BLUE}https://github.com/remsyshq/agento-self-hosted${NC}"
  echo
}

main
