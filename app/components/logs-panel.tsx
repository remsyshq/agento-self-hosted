'use client';

import { useState, useEffect, useRef } from 'react';
import { apiStreamUrl } from '@/lib/api';

export function LogsPanel({ agentId }: { agentId: string }) {
  const [logs, setLogs] = useState<string[]>([]);
  const [connected, setConnected] = useState(false);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    abortRef.current = controller;

    async function streamLogs() {
      try {
        const res = await fetch(apiStreamUrl(`/agents/${agentId}/logs?tail=200`), {
          credentials: 'include',
          signal: controller.signal,
        });

        if (!res.ok || !res.body) return;
        setConnected(true);

        const reader = res.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n');
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));
                if (data.line) {
                  setLogs((prev) => [...prev.slice(-999), data.line]);
                }
              } catch {}
            }
          }
        }
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          console.error('Log stream error:', err);
        }
      } finally {
        setConnected(false);
      }
    }

    streamLogs();
    return () => controller.abort();
  }, [agentId]);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--card)]">
      <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-2">
        <span className="text-sm font-medium">Container Logs</span>
        <span className={`text-xs ${connected ? 'text-green-400' : 'text-[var(--muted-foreground)]'}`}>
          {connected ? 'Connected' : 'Disconnected'}
        </span>
      </div>
      <div className="h-[600px] overflow-y-auto p-4 font-mono text-xs leading-relaxed">
        {logs.length === 0 ? (
          <p className="text-[var(--muted-foreground)]">No logs yet. Start the agent to see logs.</p>
        ) : (
          logs.map((line, i) => (
            <div key={i} className="text-[var(--muted-foreground)] hover:text-[var(--foreground)]">
              {line}
            </div>
          ))
        )}
        <div ref={logsEndRef} />
      </div>
    </div>
  );
}
