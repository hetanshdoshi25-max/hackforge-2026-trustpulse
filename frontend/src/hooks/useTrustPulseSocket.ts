import { useEffect, useRef, useState } from 'react';
import { socketService, type SocketStatus } from '../services/websocket';
import type { WebSocketMessage, WebSocketMessageType } from '../types/api';

export function useTrustPulseSocket(onUpdate?: (msg: WebSocketMessage) => void, filterTypes?: WebSocketMessageType[]) {
  const [status, setStatus] = useState<SocketStatus>(socketService.getStatus());
  const debounceTimerRef = useRef<number | null>(null);
  const callbackRef = useRef(onUpdate);

  useEffect(() => {
    callbackRef.current = onUpdate;
  }, [onUpdate]);

  useEffect(() => {
    socketService.connect();

    const unsubStatus = socketService.onStatusChange((newStatus) => {
      setStatus(newStatus);
    });

    const unsubMessage = socketService.onMessage((msg) => {
      if (filterTypes && filterTypes.length > 0 && !filterTypes.includes(msg.type)) {
        return;
      }

      if (debounceTimerRef.current) {
        window.clearTimeout(debounceTimerRef.current);
      }

      debounceTimerRef.current = window.setTimeout(() => {
        if (callbackRef.current) {
          callbackRef.current(msg);
        }
      }, 500);
    });

    return () => {
      unsubStatus();
      unsubMessage();
      if (debounceTimerRef.current) {
        window.clearTimeout(debounceTimerRef.current);
      }
    };
  }, [filterTypes]);

  return { status };
}
