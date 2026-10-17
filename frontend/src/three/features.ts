import * as THREE from 'three';

/** Every behavioural feature the engine scores, grouped by signal. Mirrors backend/app/features.py. */
export const SIGNAL_GROUPS = [
  { id: 'keystroke', label: 'Typing rhythm', band: 'top' },
  { id: 'touch', label: 'Swipe behaviour', band: 'upper-middle' },
  { id: 'motion', label: 'Phone grip', band: 'lower-middle' },
  { id: 'riding', label: 'Riding style', band: 'bottom' },
] as const;

export type SignalGroupId = (typeof SIGNAL_GROUPS)[number]['id'];

interface FeatureDef {
  name: string;
  group: SignalGroupId;
  label: string;
}

export const FEATURES: FeatureDef[] = [
  ...[0, 1, 2, 3].map((i) => ({ name: `dwell_${i}`, group: 'keystroke' as const, label: `Key ${i + 1} hold time` })),
  ...[0, 1, 2].map((i) => ({ name: `flight_${i}`, group: 'keystroke' as const, label: `Gap after key ${i + 1}` })),
  { name: 'offx', group: 'keystroke', label: 'Tap position (left/right)' },
  { name: 'offy', group: 'keystroke', label: 'Tap position (up/down)' },
  { name: 'tapsize', group: 'keystroke', label: 'Finger contact size' },
  { name: 'swipe_dur', group: 'touch', label: 'Swipe duration' },
  { name: 'swipe_vel', group: 'touch', label: 'Swipe speed' },
  { name: 'swipe_straight', group: 'touch', label: 'Swipe straightness' },
  { name: 'swipe_angle', group: 'touch', label: 'Swipe angle' },
  { name: 'swipe_size', group: 'touch', label: 'Swipe contact size' },
  { name: 'beta', group: 'motion', label: 'Phone tilt (forward)' },
  { name: 'gamma', group: 'motion', label: 'Phone tilt (sideways)' },
  { name: 'jitter', group: 'motion', label: 'Hand steadiness' },
  { name: 'avg_speed', group: 'riding', label: 'Average speed' },
  { name: 'harsh_brake', group: 'riding', label: 'Harsh braking rate' },
  { name: 'accel_std', group: 'riding', label: 'Acceleration style' },
  { name: 'night_ratio', group: 'riding', label: 'Night riding share' },
];

export function featureLabel(name: string): string {
  return FEATURES.find((f) => f.name === name)?.label ?? name;
}

/**
 * One fixed direction per feature on a Fibonacci sphere. Features are listed group by
 * group, so each signal occupies its own latitude band (typing on top, riding at the bottom):
 * "the typing band exploded" is readable at a glance, and a feature always points the same way.
 */
export const FEATURE_DIRECTIONS: THREE.Vector3[] = (() => {
  const n = FEATURES.length;
  const golden = Math.PI * (3 - Math.sqrt(5));
  return FEATURES.map((_, i) => {
    const y = 1 - ((i + 0.5) / n) * 2;
    const r = Math.sqrt(1 - y * y);
    const theta = i * golden;
    return new THREE.Vector3(Math.cos(theta) * r, y, Math.sin(theta) * r).normalize();
  });
})();

/** Flatten a session's signals into {feature: z} (std-devs from the rider's own baseline). */
export function featureDeviations(
  signals: Record<string, { z?: Record<string, number> }> | undefined,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const group of Object.values(signals ?? {})) {
    Object.assign(out, group.z ?? {});
  }
  return out;
}

/** The engine's "normal" band: within 2 std-devs of the rider's own baseline. */
export const NORMAL_BAND_Z = 2;
