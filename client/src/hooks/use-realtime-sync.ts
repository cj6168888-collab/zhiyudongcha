import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getAuthenticatedWsUrlAsync } from "@/lib/queryClient";

export function useRealtimeSync() {
  const queryClient = useQueryClient();
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const connect = async () => {
      const wsUrl = await getAuthenticatedWsUrlAsync('/ws/z3');
      
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        const storedId = sessionStorage.getItem('z3_user_id');
        const userId = storedId || `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        if (!storedId) sessionStorage.setItem('z3_user_id', userId);
        
        ws.send(JSON.stringify({
          type: 'SYNC_LISTENER',
          userId,
        }));
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.type === 'DATA_CHANGE') {
            if (data.entity === 'person') {
              queryClient.invalidateQueries({ predicate: (query) => {
                const key = query.queryKey;
                return Array.isArray(key) && key[0] === 'persons';
              }});
            } else if (data.entity === 'vault') {
              queryClient.invalidateQueries({ predicate: (query) => {
                const key = query.queryKey;
                return Array.isArray(key) && (key[0] === '/api/vault' || key[0] === 'vault');
              }});
            }
          }
        } catch (e) {
          console.error('[Sync] Message parse error:', e);
        }
      };

      ws.onclose = () => {
        reconnectTimeoutRef.current = setTimeout(() => {
          if (wsRef.current?.readyState === WebSocket.CLOSED) {
            connect();
          }
        }, 5000);
      };

      ws.onerror = () => {
        ws.close();
      };
    };

    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      wsRef.current?.close();
    };
  }, [queryClient]);
}
