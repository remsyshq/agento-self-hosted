#!/usr/bin/env node
import { Command } from 'commander';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { createInterface } from 'readline';
import { execSync } from 'child_process';
import { ensureDataDir, getDataDir, saveConfig } from './config.js';
import { generateMasterKey, generateApiSecret, getMasterKeyPath } from './server/services/secrets.js';
import { runMigrations } from './db/migrate.js';

const program = new Command();

program
  .name('agento')
  .description('Self-hosted Agento agent platform')
  .version('0.1.0');

// ── agento init ─────────────────────────────────────────────────────────────

program
  .command('init')
  .description('Initialize Agento (first-time setup)')
  .action(async () => {
    console.log('\n  Agento Self-Hosted Setup\n');

    const dataDir = getDataDir();
    if (existsSync(join(dataDir, 'config.json'))) {
      console.log(`  Already initialized at ${dataDir}`);
      console.log('  Run "agento start" to launch.\n');
      return;
    }

    // Check Docker
    try {
      execSync('docker info', { stdio: 'ignore' });
    } catch {
      console.error('  Error: Docker is not running. Please start Docker Desktop and try again.');
      process.exit(1);
    }

    // Prompt for admin credentials
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const ask = (q: string): Promise<string> =>
      new Promise((resolve) => rl.question(q, resolve));

    const email = await ask('  Admin email: ');
    const password = await ask('  Admin password: ');
    rl.close();

    if (!email || !password) {
      console.error('\n  Error: Email and password are required.');
      process.exit(1);
    }

    if (password.length < 8) {
      console.error('\n  Error: Password must be at least 8 characters.');
      process.exit(1);
    }

    // Create directories
    console.log('\n  Creating directories...');
    ensureDataDir();

    // Generate master key
    console.log('  Generating encryption keys...');
    generateMasterKey();
    const apiSecret = generateApiSecret();

    // Generate self-signed TLS cert
    console.log('  Generating TLS certificate...');
    const tlsDir = join(dataDir, 'tls');
    try {
      execSync(
        `openssl req -x509 -newkey rsa:2048 -keyout "${tlsDir}/key.pem" -out "${tlsDir}/cert.pem" -days 365 -nodes -subj "/CN=agento-self-hosted"`,
        { stdio: 'ignore' }
      );
    } catch {
      console.log('  Warning: Could not generate TLS certificate. HTTPS will not be available.');
    }

    // Save config
    saveConfig({
      dockerImage: 'openclaw:latest',
      tlsCert: join(tlsDir, 'cert.pem'),
      tlsKey: join(tlsDir, 'key.pem'),
    });

    // Initialize database
    console.log('  Initializing database...');
    runMigrations();

    // Create admin user via better-auth
    const { getAuth } = await import('./auth.js');
    const auth = getAuth();
    const ctx = await auth.api.signUpEmail({
      body: { name: 'Admin', email, password },
    });
    if (!ctx) {
      console.error('  Error: Failed to create admin user.');
      process.exit(1);
    }

    // Store API secret in settings
    const { getDb } = await import('./db/index.js');
    const { settings } = await import('./db/schema.js');
    const db = getDb();
    db.insert(settings).values({ key: 'api_secret', value: apiSecret }).run();
    db.insert(settings).values({ key: 'port_counter', value: '18800' }).run();

    console.log('\n  Agento initialized successfully!');
    console.log(`  Data directory: ${dataDir}`);
    console.log(`  Admin email: ${email}`);
    console.log('\n  Next steps:');
    console.log('    agento start    # Start the platform');
    console.log('    agento open     # Open in browser\n');
  });

// ── agento start ────────────────────────────────────────────────────────────

program
  .command('start')
  .description('Start Agento services')
  .action(async () => {
    const dataDir = getDataDir();
    if (!existsSync(join(dataDir, 'config.json'))) {
      console.error('  Agento is not initialized. Run "agento init" first.');
      process.exit(1);
    }

    console.log('\n  Starting Agento...\n');

    const { startServer } = await import('./server/index.js');
    await startServer();
  });

// ── agento stop ─────────────────────────────────────────────────────────────

program
  .command('stop')
  .description('Stop Agento services')
  .action(async () => {
    console.log('\n  Stopping Agento...');
    try {
      const response = await fetch('http://localhost:3001/health');
      if (response.ok) {
        // Send shutdown signal
        process.kill(
          parseInt(readFileSync(join(getDataDir(), 'agento.pid'), 'utf-8').trim()),
          'SIGTERM'
        );
        console.log('  Agento stopped.\n');
      }
    } catch {
      console.log('  Agento is not running.\n');
    }
  });

// ── agento status ───────────────────────────────────────────────────────────

program
  .command('status')
  .description('Show service status and running agents')
  .action(async () => {
    try {
      const res = await fetch('http://localhost:3001/health');
      if (res.ok) {
        const data = await res.json();
        console.log('\n  Agento is running');
        console.log(`  Orchestrator: http://localhost:3001`);
        console.log(`  Frontend:     http://localhost:3000`);

        const agentsRes = await fetch('http://localhost:3001/agents');
        if (agentsRes.ok) {
          const agents = await agentsRes.json() as any[];
          const running = agents.filter((a: any) => a.status === 'running');
          console.log(`\n  Agents: ${running.length} running / ${agents.length} total\n`);

          for (const agent of agents) {
            const status = agent.status === 'running' ? '\x1b[32m●\x1b[0m' : '\x1b[90m○\x1b[0m';
            console.log(`  ${status} ${agent.name} (${agent.status})`);
          }
          console.log();
        }
      }
    } catch {
      console.log('\n  Agento is not running.');
      console.log('  Run "agento start" to launch.\n');
    }
  });

// ── agento open ─────────────────────────────────────────────────────────────

program
  .command('open')
  .description('Open Agento in browser')
  .action(() => {
    const url = 'http://localhost:3000';
    const cmd = process.platform === 'darwin' ? 'open' : 'xdg-open';
    try {
      execSync(`${cmd} ${url}`);
      console.log(`  Opened ${url}`);
    } catch {
      console.log(`  Open ${url} in your browser.`);
    }
  });

// ── agento token ────────────────────────────────────────────────────────────

program
  .command('token')
  .description('Print API token')
  .action(async () => {
    const dataDir = getDataDir();
    if (!existsSync(join(dataDir, 'config.json'))) {
      console.error('  Agento is not initialized. Run "agento init" first.');
      process.exit(1);
    }

    const { getDb } = await import('./db/index.js');
    const { settings } = await import('./db/schema.js');
    const { eq } = await import('drizzle-orm');
    const db = getDb();
    const row = db.select().from(settings).where(eq(settings.key, 'api_secret')).get();
    if (row) {
      console.log(row.value);
    } else {
      console.error('  No API secret found. Re-run "agento init".');
    }
  });

program.parse();
