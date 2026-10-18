import * as THREE from 'three';
import { FEATURES } from './signals';

export * from './signals';

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
