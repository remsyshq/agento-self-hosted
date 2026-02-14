'use client';

import { useEffect, useRef, useState } from 'react';

export function TerminalPanel({ agentId }: { agentId: string }) {
  const termRef = useRef<HTMLDivElement>(null);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const xtermRef = useRef<any>(null);

  useEffect(() => {
    let terminal: any;
    let fitAddon: any;

    async function init() {
      // Dynamic import xterm (client-only)
      const { Terminal } = await import('@xterm/xterm');
      const { FitAddon } = await import('@xterm/addon-fit');

      // Import CSS
      await import('@xterm/xterm/css/xterm.css');

      terminal = new Terminal({
        theme: {
          background: '#0a0a0c',
          foreground: '#fafafa',
          cursor: '#fafafa',
        },
        fontFamily: 'ui-monospace, monospace',
        fontSize: 13,
      });

      fitAddon = new FitAddon();
      terminal.loadAddon(fitAddon);

      if (termRef.current) {
        terminal.open(termRef.current);
        fitAddon.fit();
      }

      xtermRef.current = terminal;

      // Connect WebSocket
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//localhost:3001/agents/${agentId}/terminal`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.binaryType = 'arraybuffer';

      ws.onopen = () => {
        setConnected(true);
        terminal.writeln('Connected to container shell.\r\n');
      };

      ws.onmessage = (event) => {
        const data = event.data instanceof ArrayBuffer
          ? new TextDecoder().decode(event.data)
          : event.data;
        terminal.write(data);
      };

      ws.onclose = () => {
        setConnected(false);
        terminal.writeln('\r\nDisconnected.');
      };

      ws.onerror = () => {
        setConnected(false);
        terminal.writeln('\r\nConnection error.');
      };

      terminal.onData((data: string) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(data);
        }
      });

      // Handle resize
      const resizeObs = new ResizeObserver(() => fitAddon.fit());
      if (termRef.current) resizeObs.observe(termRef.current);

      return () => {
        resizeObs.disconnect();
      };
    }

    const cleanup = init();

    return () => {
      cleanup.then((fn) => fn?.());
      wsRef.current?.close();
      xtermRef.current?.dispose();
    };
  }, [agentId]);

  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--card)]">
      <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-2">
        <span className="text-sm font-medium">Terminal</span>
        <span className={`text-xs ${connected ? 'text-green-400' : 'text-[var(--muted-foreground)]'}`}>
          {connected ? 'Connected' : 'Disconnected'}
        </span>
      </div>
      <div ref={termRef} className="h-[600px] p-2" />
    </div>
  );
}
