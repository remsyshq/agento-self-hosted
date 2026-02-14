# Agento Self-Hosted

## Commit Style

- Conventional commits: `feat:`, `fix:`, `docs:`, `chore:`
- **NEVER** add `Co-Authored-By` trailers or any Claude Code signatures to commits
- Keep commit messages concise (1-2 sentences)

## Structure

```
agento-self-hosted/
├── src/                # Backend orchestrator (Fastify + SQLite)
│   ├── cli.ts          # CLI entry point (agento init/start/stop/status)
│   ├── db/             # Drizzle ORM schema + migrations
│   ├── server/         # Fastify routes and services
│   │   ├── routes/     # API endpoints
│   │   └── services/   # Docker, secrets, monitor, ports
│   ├── auth.ts         # better-auth instance
│   ├── config.ts       # ~/.agento/config.json management
│   └── types.ts        # Shared types
├── app/                # Frontend (Next.js)
│   ├── app/            # App router pages
│   ├── components/     # React components
│   └── lib/            # API client, auth client, types
├── install.sh          # curl installer
├── uninstall.sh        # clean removal
└── nginx/              # nginx vhost config
```

## Tech Stack

- **Backend:** Fastify, Drizzle ORM, better-sqlite3, better-auth
- **Frontend:** Next.js 15, React 19, Tailwind CSS 4, xterm.js
- **Database:** SQLite (stored at ~/.agento/agento.db)
- **Auth:** better-auth with email/password + session cookies
- **Containers:** Docker via child_process (no dockerode)

## Key Patterns

- ESM throughout (`type: "module"`)
- AES-256-GCM for API key encryption (master key at `~/.agento/master.key`)
- Container credential callbacks via `http://host.docker.internal:<port>/internal/credentials`
- Sequential port allocation from 18800+
- Background container status polling every 10s
