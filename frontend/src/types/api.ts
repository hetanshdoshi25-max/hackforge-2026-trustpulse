/**
 * TrustPulse API TypeScript Definitions
 * Directly matching backend/app/schemas.py and backend/app/main.py
 */

export type ActionType = 'ENROLLING' | 'ALLOW' | 'SOFT_CHECK' | 'STEP_UP' | 'REVIEW';
export type SessionStatusType = 'ACTIVE' | 'PENDING_REVIEW' | 'VERIFIED' | 'BLOCKED';
export type AlertType = 'SOFT_CHECK' | 'STEP_UP' | 'REVIEW' | 'SELFIE_SUBMITTED';

export interface TimelineEntry {
  t: number;
  trust: number;
  action: ActionType;
}

export interface SignalGroupDetail {
  match: number; // 0-100 percentage match with baseline
  top: [string, number][]; // [feature_name, anomaly_distance]
}

export interface Session {
  session_id: string;
  rider_id: string;
  name: string;
  city: string | null;
  lat: number | null;
  lon: number | null;
  device_id: string | null;
  ts: number;
  received_at: number;
  enrolling: boolean;
  enroll_progress: number;
  enroll_target: number;
  trust: number; // 0 - 100
  risk: number; // 0 - 100 (100 - trust)
  behaviour_risk: number | null; // 0 - 100
  context_risk: number; // 0 - 100
  action: ActionType;
  status: SessionStatusType;
  verdict: string;
  reasons: string[];
  signals: Record<string, SignalGroupDetail>;
  timeline: TimelineEntry[];
  has_selfie: boolean;
  label?: string | null; // "genuine" | "takeover" in simulator
}

export interface RiderListItem {
  rider_id: string;
  name: string;
  enrolled: boolean;
  enroll_progress: number;
  sessions: number;
  known_devices: number;
  known_cities: string[];
  last: Session | null;
}

export interface RiderDetail {
  rider_id: string;
  name: string;
  enrolled: boolean;
  enroll_progress: number;
  sessions: number;
  known_devices: string[];
  known_cities: string[];
  baseline_samples: Record<string, number>;
  history: Session[];
}

export interface Alert extends Omit<Session, 'timeline'> {
  alert_type: AlertType;
  alert_at: number;
}

export interface SessionStartPayload {
  rider_id: string;
  name?: string | null;
  pin?: string | null;
  device_id: string;
  sim_id?: string | null;
  city?: string | null;
  lat?: number | null;
  lon?: number | null;
  ts?: number | null;
}

export interface KeyTelemetry {
  key: string;
  down: number;
  up: number;
  x?: number | null;
  y?: number | null;
  size?: number | null;
}

export interface TouchTelemetry {
  dur: number;
  dx: number;
  dy: number;
  path: number;
  size?: number | null;
}

export interface MotionTelemetry {
  t: number;
  ax?: number | null;
  ay?: number | null;
  az?: number | null;
  beta?: number | null;
  gamma?: number | null;
}

export interface RidingTelemetry {
  avg_speed?: number | null;
  harsh_brake?: number | null;
  accel_std?: number | null;
  night_ratio?: number | null;
}

export interface SessionEventsPayload {
  keystrokes?: KeyTelemetry[];
  touches?: TouchTelemetry[];
  motion?: MotionTelemetry[];
  riding?: RidingTelemetry | null;
}

export interface StepUpPayload {
  image: string; // "data:image/jpeg;base64,..."
}

export interface ResolvePayload {
  decision: 'approve' | 'reject';
}

export interface AppConfig {
  threshold: number;
  min_enroll: number;
}

export interface TradeoffCurvePoint {
  threshold: number;
  false_lockout: number;
  false_lockout_life_change: number;
  honest_riders_ever_stopped: number;
  takeover_caught: number;
  takeover_caught_same_device: number;
  accounts_caught: number;
  accounts_caught_first_session: number;
  median_sessions_to_catch: number | null;
}

export interface BaselineMetricItem {
  false_lockout: number;
  false_lockout_life_change: number;
  honest_riders_ever_stopped: number;
  takeover_caught: number;
  takeover_caught_same_device: number;
  accounts_caught: number;
  accounts_caught_first_session: number;
  median_sessions_to_catch: number | null;
}

export interface Baselines {
  open_gate: BaselineMetricItem;
  strict_gate: BaselineMetricItem;
  context_rules: BaselineMetricItem;
  trustpulse: BaselineMetricItem;
}

export interface RiskHistogram {
  bin_size: number;
  genuine: number[];
  takeover: number[];
}

export interface TradeoffMetrics {
  default_threshold: number;
  fleet: {
    riders: number;
    scored_sessions: number;
    genuine_sessions: number;
    life_change_sessions: number;
    takeover_sessions: number;
    takeover_accounts: number;
  };
  curve: TradeoffCurvePoint[];
  baselines: Baselines;
  risk_histogram: RiskHistogram;
}

export type WebSocketMessageType = 'session' | 'alert' | 'config' | 'rider_reset';

export interface WebSocketMessage<T = unknown> {
  type: WebSocketMessageType;
  data: T;
}
