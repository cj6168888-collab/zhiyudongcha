import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getAuthenticatedWsUrlAsync } from "@/lib/queryClient";
import { useZ1Store, type AcademicLevel } from "@/lib/z1/god-protocol";

// Maps server-side level names to client AcademicLevel
const SERVER_LEVEL_MAP: Record<string, AcademicLevel> = {
  BACHELOR: 'BACHELOR',
  MASTER:   'MASTER',
  PHD:      'DOCTOR',
  POSTDOC:  'PROFESSOR',
};

interface HpUpdatedMsg {
  type: 'HP_UPDATED';
  balance: number;
  consumed: number;
  actionType: string;
  timestamp: number;
}

interface EvolutionUpdateMsg {
  type: 'EVOLUTION_UPDATE';
  totalXp: number;
  xpGained: number;
  levelUp: { from: string; to: string } | null;
  state: Record<string, unknown>;
  timestamp: number;
}

type SyncMsg = HpUpdatedMsg | EvolutionUpdateMsg | { type: string };

export function useHpEvolutionSync(enabled = true) {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!enabled) {
      wsRef.current?.close();
      wsRef.current = null;
      return;
    }

    const connect = async () => {
      const wsUrl = await getAuthenticatedWsUrlAsync('/ws/z3');
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        ws.send(JSON.stringify({ type: 'HP_EVOLUTION_LISTENER' }));
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data as string) as SyncMsg;

          if (msg.type === 'HP_UPDATED') {
            const { balance } = msg as HpUpdatedMsg;
            useZ1Store.setState({ hpBalance: balance });
          }

          if (msg.type === 'EVOLUTION_UPDATE') {
            const { totalXp, levelUp } = msg as EvolutionUpdateMsg;
            const patch: Partial<{ academicXp: number; academicLevel: AcademicLevel }> = {
              academicXp: totalXp,
            };
            if (levelUp) {
              const mapped = SERVER_LEVEL_MAP[levelUp.to];
              if (mapped) patch.academicLevel = mapped;
            }
            useZ1Store.setState(patch);
            // 进化数据变更后让 React Query 缓存失效，驱动仪表盘刷新
            queryClient.invalidateQueries({ queryKey: ['/api/evolution'] });
            queryClient.invalidateQueries({ queryKey: ['/api/evolution-state'] });
          }
        } catch {
          // ignore malformed messages
        }
      };

      ws.onclose = () => {
        reconnectRef.current = setTimeout(() => {
          if (wsRef.current?.readyState === WebSocket.CLOSED) connect();
        }, 5000);
      };

      ws.onerror = () => ws.close();
    };

    connect();

    return () => {
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
      wsRef.current?.close();
    };
  }, [enabled, queryClient]);
}
