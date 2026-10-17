import type { WebSocketMessage } from '../types/api';

export type SocketStatus = 'connecting' | 'connected' | 'disconnected' | 'error';
type MessageCallback = (msg: WebSocketMessage) => void;
type StatusCallback = (status: SocketStatus) => void;

class TrustPulseSocket {
  private ws: WebSocket | null = null;
  private status: SocketStatus = 'disconnected';
  private messageListeners: Set<MessageCallback> = new Set();
  private statusListeners: Set<StatusCallback> = new Set();
  private reconnectAttempts = 0;
  private reconnectTimer: number | null = null;
  private pingTimer: number | null = null;
  private shouldConnect = false;

  private getWebSocketUrl(): string {
    const customUrl = import.meta.env.VITE_WS_URL;
    if (customUrl) return customUrl;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    return `${protocol}//${host}/ws`;
  }

  public connect(): void {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    this.shouldConnect = true;
    this.setStatus('connecting');

    try {
      const url = this.getWebSocketUrl();
      this.ws = new WebSocket(url);

      this.ws.onopen = () => {
        this.reconnectAttempts = 0;
        this.setStatus('connected');
        this.startKeepAlive();
      };

      this.ws.onmessage = (event: MessageEvent) => {
        try {
          const parsed = JSON.parse(event.data) as WebSocketMessage;
          if (parsed && parsed.type) {
            this.notifyMessage(parsed);
          }
        } catch {
          // ignore malformed message
        }
      };

      this.ws.onerror = () => {
        this.setStatus('error');
      };

      this.ws.onclose = () => {
        this.stopKeepAlive();
        this.setStatus('disconnected');
        this.ws = null;
        if (this.shouldConnect) {
          this.scheduleReconnect();
        }
      };
    } catch {
      this.setStatus('error');
      if (this.shouldConnect) {
        this.scheduleReconnect();
      }
    }
  }

  public disconnect(): void {
    this.shouldConnect = false;
    if (this.reconnectTimer) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.stopKeepAlive();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.setStatus('disconnected');
  }

  private startKeepAlive(): void {
    this.stopKeepAlive();
    this.pingTimer = window.setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        try {
          this.ws.send('ping');
        } catch {
          // ignore
        }
      }
    }, 25000);
  }

  private stopKeepAlive(): void {
    if (this.pingTimer) {
      window.clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    const delay = Math.min(1000 * Math.pow(1.5, this.reconnectAttempts), 10000);
    this.reconnectAttempts++;
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      if (this.shouldConnect) {
        this.connect();
      }
    }, delay);
  }

  private setStatus(status: SocketStatus): void {
    this.status = status;
    this.statusListeners.forEach((listener) => listener(status));
  }

  private notifyMessage(msg: WebSocketMessage): void {
    this.messageListeners.forEach((listener) => listener(msg));
  }

  public onMessage(callback: MessageCallback): () => void {
    this.messageListeners.add(callback);
    return () => this.messageListeners.delete(callback);
  }

  public onStatusChange(callback: StatusCallback): () => void {
    this.statusListeners.add(callback);
    callback(this.status);
    return () => this.statusListeners.delete(callback);
  }

  public getStatus(): SocketStatus {
    return this.status;
  }
}

export const socketService = new TrustPulseSocket();
