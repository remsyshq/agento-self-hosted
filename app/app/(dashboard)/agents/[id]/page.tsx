'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Play, Square, RotateCw, Trash2, MessageSquare, ScrollText, Terminal, Settings } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { ChatPanel } from '@/components/chat-panel';
import { LogsPanel } from '@/components/logs-panel';
import { TerminalPanel } from '@/components/terminal-panel';
import type { Agent } from '@/lib/types';
import { toast } from 'sonner';

type Tab = 'chat' | 'logs' | 'terminal' | 'settings';

const TABS: { id: Tab; label: string; icon: typeof MessageSquare }[] = [
  { id: 'chat', label: 'Chat', icon: MessageSquare },
  { id: 'logs', label: 'Logs', icon: ScrollText },
  { id: 'terminal', label: 'Terminal', icon: Terminal },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export default function AgentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [agent, setAgent] = useState<Agent | null>(null);
  const [tab, setTab] = useState<Tab>('chat');
  const [actionLoading, setActionLoading] = useState('');
  const [soulMd, setSoulMd] = useState('');

  useEffect(() => {
    fetchAgent();
    const interval = setInterval(fetchAgent, 5000);
    return () => clearInterval(interval);
  }, [id]);

  async function fetchAgent() {
    try {
      const data = await apiFetch<Agent>(`/agents/${id}`);
      setAgent(data);
      setSoulMd(data.soulMd || '');
    } catch {
      toast.error('Failed to load agent');
    }
  }

  async function doAction(action: string) {
    setActionLoading(action);
    try {
      await apiFetch(`/agents/${id}/${action}`, { method: 'POST' });
      toast.success(`Agent ${action} successful`);
      await fetchAgent();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setActionLoading('');
    }
  }

  async function deleteAgent() {
    if (!confirm('Delete this agent? This will remove the container and all data.')) return;
    try {
      await apiFetch(`/agents/${id}`, { method: 'DELETE' });
      toast.success('Agent deleted');
      router.push('/');
    } catch (err: any) {
      toast.error(err.message);
    }
  }

  async function saveSoul() {
    try {
      await apiFetch(`/agents/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ soulMd }),
      });
      toast.success('Instructions saved');
    } catch (err: any) {
      toast.error(err.message);
    }
  }

  if (!agent) {
    return <div className="py-12 text-center text-[var(--muted-foreground)]">Loading...</div>;
  }

  const STATUS_COLORS: Record<string, string> = {
    running: 'bg-green-500',
    stopped: 'bg-zinc-500',
    creating: 'bg-yellow-500',
    error: 'bg-red-500',
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => router.push('/')} className="text-[var(--muted-foreground)] hover:text-[var(--foreground)]">
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold">{agent.name}</h1>
          <div className="flex items-center gap-2 mt-1">
            <span className={`h-2 w-2 rounded-full ${STATUS_COLORS[agent.status]}`} />
            <span className="text-sm text-[var(--muted-foreground)] capitalize">{agent.status}</span>
            {agent.port && agent.status === 'running' && (
              <span className="text-xs text-[var(--muted-foreground)]">port {agent.port}</span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {agent.status !== 'running' && (
            <button
              onClick={() => doAction('start')}
              disabled={!!actionLoading}
              className="flex items-center gap-1.5 rounded-md bg-green-600 px-3 py-1.5 text-sm text-white hover:bg-green-700 disabled:opacity-50"
            >
              <Play size={14} />
              {actionLoading === 'start' ? 'Starting...' : 'Start'}
            </button>
          )}
          {agent.status === 'running' && (
            <>
              <button
                onClick={() => doAction('stop')}
                disabled={!!actionLoading}
                className="flex items-center gap-1.5 rounded-md bg-[var(--secondary)] px-3 py-1.5 text-sm hover:opacity-80 disabled:opacity-50"
              >
                <Square size={14} />
                {actionLoading === 'stop' ? 'Stopping...' : 'Stop'}
              </button>
              <button
                onClick={() => doAction('restart')}
                disabled={!!actionLoading}
                className="flex items-center gap-1.5 rounded-md bg-[var(--secondary)] px-3 py-1.5 text-sm hover:opacity-80 disabled:opacity-50"
              >
                <RotateCw size={14} />
                {actionLoading === 'restart' ? 'Restarting...' : 'Restart'}
              </button>
            </>
          )}
          <button
            onClick={deleteAgent}
            className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-red-400 hover:bg-red-500/10"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-[var(--border)] mb-6">
        {TABS.map(({ id: tabId, label, icon: Icon }) => (
          <button
            key={tabId}
            onClick={() => setTab(tabId)}
            className={`flex items-center gap-2 px-4 py-2 text-sm border-b-2 -mb-px ${
              tab === tabId
                ? 'border-[var(--primary)] text-[var(--foreground)]'
                : 'border-transparent text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
            }`}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'chat' && <ChatPanel agentId={id} />}
      {tab === 'logs' && <LogsPanel agentId={id} />}
      {tab === 'terminal' && <TerminalPanel agentId={id} />}
      {tab === 'settings' && (
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium mb-2">Instructions (SOUL.md)</label>
            <textarea
              value={soulMd}
              onChange={(e) => setSoulMd(e.target.value)}
              rows={10}
              className="w-full rounded-md border border-[var(--border)] bg-[var(--input)] px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[var(--ring)] resize-y"
            />
            <button
              onClick={saveSoul}
              className="mt-2 rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
            >
              Save
            </button>
          </div>

          {agent.lastError && (
            <div>
              <label className="block text-sm font-medium mb-2">Last Error</label>
              <div className="rounded-md bg-red-500/10 p-3 text-sm text-red-400 font-mono">
                {agent.lastError}
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-2">Details</label>
            <div className="rounded-md border border-[var(--border)] bg-[var(--muted)] p-4 text-sm space-y-1">
              <p><span className="text-[var(--muted-foreground)]">ID:</span> {agent.id}</p>
              <p><span className="text-[var(--muted-foreground)]">Image:</span> {agent.image}</p>
              <p><span className="text-[var(--muted-foreground)]">Container:</span> {agent.containerId || 'None'}</p>
              <p><span className="text-[var(--muted-foreground)]">Port:</span> {agent.port || 'Not assigned'}</p>
              <p><span className="text-[var(--muted-foreground)]">Created:</span> {new Date(agent.createdAt).toLocaleString()}</p>
              {agent.startedAt && (
                <p><span className="text-[var(--muted-foreground)]">Started:</span> {new Date(agent.startedAt).toLocaleString()}</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
