import { useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * Screen-space labels without drei <Html>.
 * Each <Html> is its own React root; with many live-updating labels under React 19 that
 * means constant root mount/unmount churn ("synchronously unmount a root" errors).
 * Instead, labels are plain DOM in ONE overlay next to the canvas, and this component
 * projects their 3D anchors every frame and writes the transform directly: no React
 * render per frame, no extra roots.
 */

export interface LabelAnchor {
  key: string;
  /** writes the anchor's current world position into `out` */
  at: (out: THREE.Vector3) => THREE.Vector3 | null;
}

export function LabelProjector({
  anchors,
  elements,
}: {
  anchors: LabelAnchor[];
  elements: React.MutableRefObject<Map<string, HTMLElement | null>>;
}) {
  const { camera, size } = useThree();
  const v = useMemo(() => new THREE.Vector3(), []);
  useFrame(() => {
    for (const a of anchors) {
      const el = elements.current.get(a.key);
      if (!el) continue;
      const p = a.at(v);
      if (!p) {
        el.style.visibility = 'hidden';
        continue;
      }
      p.project(camera);
      const onScreen = p.z < 1 && Math.abs(p.x) < 1.1 && Math.abs(p.y) < 1.1;
      el.style.visibility = onScreen ? 'visible' : 'hidden';
      el.style.transform = `translate(${((p.x + 1) / 2) * size.width}px, ${((1 - p.y) / 2) * size.height}px) translate(-50%, -50%)`;
    }
  });
  return null;
}
