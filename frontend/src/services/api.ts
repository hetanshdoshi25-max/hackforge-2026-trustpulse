import type {
  Alert,
  AppConfig,
  ResolvePayload,
  RiderDetail,
  RiderListItem,
  Session,
  SessionEventsPayload,
  SessionStartPayload,
  StepUpPayload,
  TradeoffMetrics,
} from '../types/api';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  const headers = new Headers(options.headers || {});

  if (!headers.has('Content-Type') && options.body && typeof options.body === 'string') {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorDetail = `HTTP ${response.status}: ${response.statusText}`;
    try {
      const data = await response.json();
      if (data && data.detail) {
        errorDetail = typeof data.detail === 'string' ? data.detail : JSON.stringify(data.detail);
      }
    } catch {
      // not JSON
    }
    throw new ApiError(errorDetail, response.status);
  }

  return response.json() as Promise<T>;
}

export const api = {
  /** Health check */
  async health(): Promise<{ ok: boolean; riders: number; sessions: number }> {
    return request('/health');
  },

  /** Start a new rider session (returns Session) */
  async startSession(payload: SessionStartPayload): Promise<Session> {
    return request<Session>('/session/start', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  /** Send behavioral telemetry (keystrokes, swipe gestures, motion) */
  async sendSessionEvents(
    sessionId: string,
    payload: SessionEventsPayload,
    label?: string
  ): Promise<Session> {
    const url = label
      ? `/session/${encodeURIComponent(sessionId)}/events?label=${encodeURIComponent(label)}`
      : `/session/${encodeURIComponent(sessionId)}/events`;
    return request<Session>(url, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  /** Get session by ID */
  async getSession(sessionId: string): Promise<Session> {
    return request<Session>(`/session/${encodeURIComponent(sessionId)}`);
  },

  /** Submit camera verification selfie */
  async submitStepUp(sessionId: string, image: string): Promise<Session> {
    const payload: StepUpPayload = { image };
    return request<Session>(`/session/${encodeURIComponent(sessionId)}/stepup`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  /** Get selfie data URL for a session */
  async getSessionSelfie(sessionId: string): Promise<{ image: string }> {
    return request<{ image: string }>(`/session/${encodeURIComponent(sessionId)}/selfie`);
  },

  /** Reviewer approve/reject action */
  async resolveSession(sessionId: string, decision: 'approve' | 'reject'): Promise<Session> {
    const payload: ResolvePayload = { decision };
    return request<Session>(`/session/${encodeURIComponent(sessionId)}/resolve`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  /** List recent sessions */
  async getSessions(limit = 100, riderId?: string): Promise<Session[]> {
    let url = `/sessions?limit=${limit}`;
    if (riderId) {
      url += `&rider_id=${encodeURIComponent(riderId)}`;
    }
    return request<Session[]>(url);
  },

  /** List review alerts queue */
  async getAlerts(limit = 50): Promise<Alert[]> {
    return request<Alert[]>(`/alerts?limit=${limit}`);
  },

  /** List all riders */
  async getRiders(): Promise<RiderListItem[]> {
    return request<RiderListItem[]>('/riders');
  },

  /** Get single rider profile, sample counts and history */
  async getRider(riderId: string): Promise<RiderDetail> {
    return request<RiderDetail>(`/riders/${encodeURIComponent(riderId)}`);
  },

  /** Reset a rider's enrollment and history */
  async resetRider(riderId: string): Promise<{ ok: boolean }> {
    return request<{ ok: boolean }>(`/riders/${encodeURIComponent(riderId)}/reset`, {
      method: 'POST',
    });
  },

  /** Get current engine strictness threshold & min_enroll */
  async getConfig(): Promise<AppConfig> {
    return request<AppConfig>('/config');
  },

  /** Update engine threshold (20-95) */
  async setConfig(threshold: number): Promise<AppConfig> {
    return request<AppConfig>('/config', {
      method: 'POST',
      body: JSON.stringify({ threshold }),
    });
  },

  /** Get evaluation trade-off curve & baseline metrics */
  async getTradeoffMetrics(): Promise<TradeoffMetrics> {
    return request<TradeoffMetrics>('/metrics/tradeoff');
  },
};

export { ApiError };
