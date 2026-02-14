# Agento Self-Hosted

Run the full Agento AI agent platform on your own infrastructure.

## Quick Start

```bash
curl -fsSL https://get.agento.host/install.sh | bash
agento init
agento start
agento open
```

## Prerequisites

- **Docker Desktop** — running and accessible
- **Node.js 20+** — with npm
- **macOS** (Apple Silicon) or **Linux** (arm64/amd64)

## Commands

| Command | Description |
|---------|-------------|
| `agento init` | First-time setup (creates admin account, generates keys) |
| `agento start` | Start orchestrator and frontend |
| `agento stop` | Stop all services |
| `agento status` | Show running agents and service health |
| `agento open` | Open dashboard in browser |
| `agento token` | Print API token |
| `agento version` | Print version |

## Architecture

Single-machine deployment. All components run on localhost:

- **Orchestrator** (port 3001) — Fastify API managing Docker containers
- **Frontend** (port 3000) — Next.js dashboard
- **SQLite** — Local database (`~/.agento/agento.db`)
- **Docker** — Each agent runs in an isolated OpenClaw container

## Data Directory

All data is stored in `~/.agento/`:

```
~/.agento/
├── agento.db          # SQLite database
├── config.json        # Configuration
├── master.key         # Encryption key (chmod 600)
├── agento.pid         # PID file when running
├── tls/               # Self-signed TLS certificate
├── agents/            # Per-agent config and workspace
│   └── {id}/
│       ├── config/    # OpenClaw configuration
│       └── workspace/ # Agent workspace
├── bin/
│   └── agento         # CLI wrapper
└── installer/         # Application code
```

## Uninstall

```bash
curl -fsSL https://get.agento.host/uninstall | bash
# or
~/.agento/installer/uninstall.sh
```

## License

[FSL 1.1 (Apache 2.0)](LICENSE) — Free to use, converts to Apache 2.0 after 4 years.
