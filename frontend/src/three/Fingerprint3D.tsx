import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Sparkles } from '@react-three/drei';
import { LabelProjector, type LabelAnchor } from './LabelProjector';
import { registerLabel } from './labels';
import * as THREE from 'three';
import type { SignalGroupDetail } from '../types/api';
import { getActionHex } from '../utils/status';
import { FEATURES, FEATURE_DIRECTIONS, NORMAL_BAND_Z, featureDeviations, featureLabel } from './features';

/**
 * The behavioural fingerprint of ONE login.
 *  - every spike is one feature, always pointing the same way
 *  - spike length = how far this login is from the rider's own baseline (std-devs)
 *  - the glass shell = the normal band (2 std-devs)
 * The owner stays inside the shell; another person's spikes burst through it.
 */

const SHELL_RADIUS = 1;
const MIN_LEN = 0.28;
const MAX_Z = 6;
const INSIDE = new THREE.Color('#d9d6cf');
const EDGE = new THREE.Color('#fde047');
const OUTSIDE = new THREE.Color('#e11d48');
const MISSING = new THREE.Color('#3a3936');

const HEARTBEAT_HZ: Record<string, number> = { ALLOW: 0.9, ENROLLING: 0.7, SOFT_CHECK: 1.5, STEP_UP: 2.3, REVIEW: 3.2 };

function spikeLength(z: number | undefined): number {
  if (z === undefined) return MIN_LEN * 0.7;
  const zc = Math.min(z, MAX_Z);
  return MIN_LEN + (zc / NORMAL_BAND_Z) * (SHELL_RADIUS - MIN_LEN);
}

function spikeColor(z: number | undefined): THREE.Color {
  if (z === undefined) return MISSING;
  if (z <= NORMAL_BAND_Z) return INSIDE;
  if (z <= 3.5) return EDGE.clone().lerp(OUTSIDE, (z - NORMAL_BAND_Z) / 1.5);
  return OUTSIDE;
}

const UP = new THREE.Vector3(0, 1, 0);
const LABEL_LIFT = new THREE.Vector3(0, 0.12, 0);

function Spike({ dir, z, tipRef }: { dir: THREE.Vector3; z?: number; tipRef: (m: THREE.Mesh | null) => void }) {
  const shaft = useRef<THREE.Mesh>(null);
  const tip = useRef<THREE.Mesh>(null);
  const len = useRef(MIN_LEN * 0.5);
  const quaternion = useMemo(() => new THREE.Quaternion().setFromUnitVectors(UP, dir), [dir]);
  const target = spikeLength(z);
  const color = spikeColor(z);

  useFrame((_, dt) => {
    len.current = THREE.MathUtils.damp(len.current, target, 5, dt);
    if (shaft.current) {
      shaft.current.scale.set(1, len.current, 1);
      shaft.current.position.copy(dir).multiplyScalar(len.current / 2);
      (shaft.current.material as THREE.MeshBasicMaterial).color.lerp(color, Math.min(1, dt * 6));
    }
    if (tip.current) {
      tip.current.position.copy(dir).multiplyScalar(len.current);
      (tip.current.material as THREE.MeshBasicMaterial).color.lerp(color, Math.min(1, dt * 6));
    }
  });

  return (
    <group>
      <mesh ref={shaft} quaternion={quaternion}>
        <cylinderGeometry args={[0.012, 0.022, 1, 6]} />
        <meshBasicMaterial color={MISSING} transparent opacity={0.9} />
      </mesh>
      <mesh
        ref={(m) => {
          tip.current = m;
          tipRef(m);
        }}
      >
        <sphereGeometry args={[z !== undefined && z > NORMAL_BAND_Z ? 0.05 : 0.032, 12, 12]} />
        <meshBasicMaterial color={MISSING} />
      </mesh>
    </group>
  );
}

function Core({ hex, hz }: { hex: string; hz: number }) {
  const core = useRef<THREE.Mesh>(null);
  const halo = useRef<THREE.Mesh>(null);
  const color = useMemo(() => new THREE.Color(hex), [hex]);
  useFrame(({ clock }, dt) => {
    // Double-beat "lub-dub" so it reads as a pulse, faster when the risk is higher.
    const t = (clock.getElapsedTime() * hz) % 1;
    const beat = Math.exp(-((t - 0.1) ** 2) / 0.002) + 0.6 * Math.exp(-((t - 0.3) ** 2) / 0.002);
    const s = 1 + beat * 0.14;
    core.current?.scale.setScalar(s);
    halo.current?.scale.setScalar(1 + beat * 0.35);
    for (const m of [core.current, halo.current]) {
      const mat = m?.material as THREE.MeshStandardMaterial | THREE.MeshBasicMaterial | undefined;
      if (mat) mat.color.lerp(color, Math.min(1, dt * 4));
    }
    if (core.current) (core.current.material as THREE.MeshStandardMaterial).emissive.lerp(color, Math.min(1, dt * 4));
  });
  return (
    <group>
      <mesh ref={core}>
        <icosahedronGeometry args={[0.2, 1]} />
        <meshStandardMaterial color={hex} emissive={hex} emissiveIntensity={1.4} flatShading roughness={0.3} />
      </mesh>
      <mesh ref={halo}>
        <sphereGeometry args={[0.42, 24, 24]} />
        <meshBasicMaterial color={hex} transparent opacity={0.1} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
    </group>
  );
}

function Shell({ hex, breached }: { hex: string; breached: boolean }) {
  const wire = useRef<THREE.Mesh>(null);
  const color = useMemo(() => new THREE.Color(breached ? '#e11d48' : hex), [hex, breached]);
  useFrame((_, dt) => {
    if (wire.current) {
      wire.current.rotation.y += dt * 0.05;
      (wire.current.material as THREE.MeshBasicMaterial).color.lerp(color, Math.min(1, dt * 3));
    }
  });
  return (
    <group>
      <mesh>
        <sphereGeometry args={[SHELL_RADIUS, 48, 48]} />
        <meshBasicMaterial color={hex} transparent opacity={0.035} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
      <mesh ref={wire}>
        <icosahedronGeometry args={[SHELL_RADIUS, 3]} />
        <meshBasicMaterial color={hex} wireframe transparent opacity={0.1} depthWrite={false} />
      </mesh>
    </group>
  );
}

/** Expanding sphere when the fingerprint breaks out of the normal band. */
function Shockwave({ trigger }: { trigger: number }) {
  const ref = useRef<THREE.Mesh>(null);
  const start = useRef<number | null>(null);
  useEffect(() => {
    if (trigger > 0) start.current = null;
  }, [trigger]);
  useFrame(({ clock }) => {
    if (!ref.current || trigger === 0) return;
    if (start.current === null) start.current = clock.getElapsedTime();
    const p = (clock.getElapsedTime() - start.current) / 1.4;
    const mat = ref.current.material as THREE.MeshBasicMaterial;
    ref.current.visible = p < 1;
    ref.current.scale.setScalar(1 + p * 2.2);
    mat.opacity = Math.max(0, 0.45 * (1 - p));
  });
  return (
    <mesh ref={ref} visible={false}>
      <sphereGeometry args={[SHELL_RADIUS, 32, 32]} />
      <meshBasicMaterial color="#e11d48" wireframe transparent opacity={0} depthWrite={false} />
    </mesh>
  );
}

export interface Fingerprint3DProps {
  signals?: Record<string, SignalGroupDetail>;
  action: string;
  height?: number | string;
  /** label the biggest outliers at their spike tips */
  labels?: boolean;
  autoRotate?: boolean;
  /** camera distance; larger shows long outlier spikes whole */
  distance?: number;
  className?: string;
}

export const Fingerprint3D: React.FC<Fingerprint3DProps> = ({
  signals,
  action,
  height = 360,
  labels = true,
  autoRotate = true,
  distance = 3.4,
  className = '',
}) => {
  const z = useMemo(() => featureDeviations(signals), [signals]);
  const hex = getActionHex(action);
  const outliers = useMemo(
    () =>
      Object.entries(z)
        .filter(([, v]) => v > NORMAL_BAND_Z)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([n]) => n),
    [z],
  );
  const breached = outliers.length > 0 && (action === 'STEP_UP' || action === 'REVIEW');

  // Outlier labels live in a DOM overlay, positioned at the spike tips every frame.
  const tips = useRef(new Map<string, THREE.Mesh>());
  const labelEls = useRef(new Map<string, HTMLElement | null>());
  const anchors = useMemo<LabelAnchor[]>(
    () =>
      labels
        ? outliers.map((name) => ({
            key: name,
            at: (o: THREE.Vector3) => {
              const m = tips.current.get(name);
              return m ? m.getWorldPosition(o).add(LABEL_LIFT) : null;
            },
          }))
        : [],
    [outliers, labels],
  );

  // Fire the shockwave on every new breach.
  const [shock, setShock] = useState(0);
  const wasBreached = useRef(false);
  useEffect(() => {
    if (breached && !wasBreached.current) setShock((s) => s + 1);
    wasBreached.current = breached;
  }, [breached]);

  return (
    <div className={`relative ${className}`} style={{ height }}>
      <Canvas camera={{ position: [0, 0.6 * (distance / 3.4), distance], fov: 45 }} dpr={[1, 2]} gl={{ antialias: true }}>
        <ambientLight intensity={0.35} />
        <pointLight position={[3, 3, 3]} intensity={30} />
        <Core hex={hex} hz={HEARTBEAT_HZ[action] ?? 1} />
        <Shell hex={hex} breached={breached} />
        <Shockwave trigger={shock} />
        {FEATURES.map((f, i) => (
          <Spike
            key={f.name}
            dir={FEATURE_DIRECTIONS[i]}
            z={z[f.name]}
            tipRef={(m) => (m ? tips.current.set(f.name, m) : tips.current.delete(f.name))}
          />
        ))}
        <LabelProjector anchors={anchors} elements={labelEls} />
        <Sparkles count={36} scale={4.5} size={1.2} speed={0.2} opacity={0.35} color="#edebe6" />
        <OrbitControls enablePan={false} enableZoom={false} autoRotate={autoRotate} autoRotateSpeed={0.7} />
      </Canvas>
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {labels &&
          outliers.map((name) => (
            <div
              key={name}
              ref={registerLabel(labelEls, name)}
              className="invisible absolute left-0 top-0 whitespace-nowrap border-l-2 border-review bg-ink/90 px-2 py-0.5 font-mono text-[11px] text-paper"
            >
              {featureLabel(name)} <span className="text-review">{(z[name] ?? 0).toFixed(1)}σ</span>
            </div>
          ))}
      </div>
    </div>
  );
};

/** DOM legend for the fingerprint: identity is never colour alone. */
export const FingerprintLegend: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`flex flex-wrap items-center gap-x-5 gap-y-1.5 font-mono text-[10.5px] text-mute ${className}`}>
    <span className="flex items-center gap-2">
      <span className="inline-block h-2.5 w-2.5 rounded-full border border-paper-2" /> shell = this rider's normal (2σ)
    </span>
    <span className="flex items-center gap-2">
      <span className="inline-block h-px w-4 bg-paper" /> inside = matches
    </span>
    <span className="flex items-center gap-2">
      <span className="inline-block h-px w-4 bg-review" /> through the shell = doesn't
    </span>
    <span className="text-dim">bands top to bottom: typing · swipe · grip · riding</span>
  </div>
);
