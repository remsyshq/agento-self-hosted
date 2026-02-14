'use client';

import { useEffect, useState } from 'react';
import { Plus, Trash2, Key } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import type { Provider, ProviderType } from '@/lib/types';
import { toast } from 'sonner';

const PROVIDER_OPTIONS: { value: ProviderType; label: string }[] = [
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'openai', label: 'OpenAI' },
  { value: 'google', label: 'Google' },
];

export default function ProvidersPage() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [provider, setProvider] = useState<ProviderType>('anthropic');
  const [label, setLabel] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchProviders();
  }, []);

  async function fetchProviders() {
    try {
      const data = await apiFetch<Provider[]>('/providers');
      setProviders(data);
    } catch {
      toast.error('Failed to load providers');
    }
  }

  async function addProvider(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const p = await apiFetch<Provider>('/providers', {
        method: 'POST',
        body: JSON.stringify({ provider, label: label || provider, apiKey }),
      });
      setProviders((prev) => [...prev, p]);
      setShowAdd(false);
      setApiKey('');
      setLabel('');
      toast.success('Provider added');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function removeProvider(id: string) {
    if (!confirm('Remove this API key?')) return;
    try {
      await apiFetch(`/providers/${id}`, { method: 'DELETE' });
      setProviders((prev) => prev.filter((p) => p.id !== id));
      toast.success('Provider removed');
    } catch (err: any) {
      toast.error(err.message);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold">Providers</h1>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="flex items-center gap-2 rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          <Plus size={16} />
          Add API Key
        </button>
      </div>

      {showAdd && (
        <form onSubmit={addProvider} className="mb-6 rounded-lg border border-[var(--border)] bg-[var(--card)] p-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Provider</label>
              <select
                value={provider}
                onChange={(e) => setProvider(e.target.value as ProviderType)}
                className="w-full rounded-md border border-[var(--border)] bg-[var(--input)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
              >
                {PROVIDER_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Label</label>
              <input
                type="text"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="e.g. Production key"
                className="w-full rounded-md border border-[var(--border)] bg-[var(--input)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">API Key</label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              required
              placeholder="sk-..."
              className="w-full rounded-md border border-[var(--border)] bg-[var(--input)] px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
            />
          </div>

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setShowAdd(false)}
              className="rounded-md px-4 py-2 text-sm text-[var(--muted-foreground)]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              {loading ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      )}

      {providers.length === 0 ? (
        <div className="text-center py-12">
          <Key size={40} className="mx-auto mb-4 text-[var(--muted-foreground)]" />
          <p className="text-[var(--muted-foreground)]">
            No API keys configured. Add one to start creating agents.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {providers.map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--card)] px-4 py-3"
            >
              <div className="flex items-center gap-4">
                <div className="flex h-9 w-9 items-center justify-center rounded-md bg-[var(--muted)]">
                  <Key size={16} className="text-[var(--muted-foreground)]" />
                </div>
                <div>
                  <p className="text-sm font-medium">{p.label}</p>
                  <p className="text-xs text-[var(--muted-foreground)]">
                    {p.provider} &middot; {p.keyPreview}
                  </p>
                </div>
              </div>
              <button
                onClick={() => removeProvider(p.id)}
                className="text-[var(--muted-foreground)] hover:text-red-400"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
