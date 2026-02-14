'use client';

import Link from 'next/link';
import { Bot, Cpu, MemoryStick } from 'lucide-react';
import type { Agent } from '@/lib/types';

const STATUS_COLORS: Record<string, string> = {
  running: 'bg-green-500',
  stopped: 'bg-zinc-500',
  creating: 'bg-yellow-500',
  error: 'bg-red-500',
};

export function AgentCard({ agent }: { agent: Agent }) {
  return (
    <Link
      href={`/agents/${agent.id}`}
      className="block rounded-lg border border-[var(--border)] bg-[var(--card)] p-4 transition hover:border-[var(--muted-foreground)]"
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-[var(--muted)]">
            <Bot size={20} className="text-[var(--muted-foreground)]" />
          </div>
          <div>
            <h3 className="font-medium">{agent.name}</h3>
            <div className="flex items-center gap-2 mt-1">
              <span
                className={`inline-block h-2 w-2 rounded-full ${STATUS_COLORS[agent.status] || 'bg-zinc-500'}`}
              />
              <span className="text-xs text-[var(--muted-foreground)] capitalize">
                {agent.status}
              </span>
            </div>
          </div>
        </div>
      </div>

      {agent.containerStatus?.running && (
        <div className="mt-3 flex items-center gap-4 text-xs text-[var(--muted-foreground)]">
          <span className="flex items-center gap-1">
            <Cpu size={12} />
            {agent.containerStatus.cpu}
          </span>
          <span className="flex items-center gap-1">
            <MemoryStick size={12} />
            {agent.containerStatus.memory}
          </span>
        </div>
      )}

      {agent.lastError && (
        <p className="mt-2 text-xs text-red-400 truncate">{agent.lastError}</p>
      )}

      {agent.provider && (
        <div className="mt-2">
          <span className="inline-flex items-center rounded-full bg-[var(--muted)] px-2 py-0.5 text-xs text-[var(--muted-foreground)]">
            {agent.provider.provider}
          </span>
        </div>
      )}
    </Link>
  );
}
