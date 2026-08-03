import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { websocketUrl } from '../lib/api.js';
import { apiRequest } from '../lib/api.js';

export type LiveConnectionState = 'connecting' | 'connected' | 'disconnected';

export function useLiveUpdates(token: string): LiveConnectionState {
  const queryClient = useQueryClient();
  const [state, setState] = useState<LiveConnectionState>('connecting');
  const retryRef = useRef(0);

  useEffect(() => {
    if (!token) return undefined;
    let socket: WebSocket | null = null;
    let timer: number | undefined;
    let stopped = false;

    const connect = async () => {
      if (stopped) return;
      setState('connecting');
      try {
        const ticket = await apiRequest<{ token: string; expiresInSeconds: number }>(
          '/api/v1/auth/live-token',
          { method: 'POST' },
          token,
        );
        if (stopped) return;
        socket = new WebSocket(websocketUrl(ticket.token));
      } catch {
        if (stopped) return;
        setState('disconnected');
        const retryMs = Math.min(1_000 * 2 ** retryRef.current, 30_000);
        retryRef.current += 1;
        timer = window.setTimeout(() => void connect(), retryMs);
        return;
      }
      socket.addEventListener('open', () => {
        retryRef.current = 0;
        setState('connected');
      });
      socket.addEventListener('message', (event) => {
        try {
          const message = JSON.parse(String(event.data)) as { type?: string };
          if (message.type === 'CONNECTED') return;
          void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
          void queryClient.invalidateQueries({ queryKey: ['agents'] });
          void queryClient.invalidateQueries({ queryKey: ['calls'] });
          void queryClient.invalidateQueries({ queryKey: ['automation-runs'] });
        } catch {
          // A malformed realtime message is ignored; polling remains a fallback.
        }
      });
      socket.addEventListener('close', () => {
        if (stopped) return;
        setState('disconnected');
        const retryMs = Math.min(1_000 * 2 ** retryRef.current, 30_000);
        retryRef.current += 1;
        timer = window.setTimeout(() => void connect(), retryMs);
      });
      socket.addEventListener('error', () => socket?.close());
    };

    void connect();
    return () => {
      stopped = true;
      if (timer) window.clearTimeout(timer);
      socket?.close();
    };
  }, [queryClient, token]);

  return state;
}
