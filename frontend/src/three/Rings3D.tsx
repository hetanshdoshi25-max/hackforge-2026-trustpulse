import React, { useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Line, OrbitControls, Sparkles } from '@react-three/drei';
import * as THREE from 'three';
import type { RentalRing } from '../types/api';
import { LabelProjector, type LabelAnchor } from './LabelProjector';
import { registerLabel } from './labels';

/**
 * Each rental ring: one unknown person (red, pulsing, centre) and the verified
 * accounts they ride (spokes). Spoke opacity = behaviour match; dashed = same phone.
 */

const RED = '#e11d48';
const ACCOUNT = '#edebe6';

interface Layout {
  ring: RentalRing;
  centre: THREE.Vector3;
  accounts: { id: string; name: string; pos: THREE.Vector3 }[];
}

function layout(rings: RentalRing[]): Layout[] {
  const n = rings.length;
  const R = n <= 1 ? 0 : 1.6 + n * 0.25;
  return rings.map((ring, i) => {
    const a = (i / Math.max(1, n)) * Math.PI * 2;
    const centre = new THREE.Vector3(Math.cos(a) * R, 0, Math.sin(a) * R);
    const m = ring.members.length;
    return {
      ring,
      centre,
      accounts: ring.members.map((mem, j) => {
        const b = (j / m) * Math.PI * 2 + a;
        return { id: mem.rider_id, name: mem.name, pos: centre.clone().add(new THREE.Vector3(Math.cos(b) * 1.0, 0.25 * Math.sin(j * 2.1), Math.sin(b) * 1.0)) };
      }),
    };
  });
}

function Renter({ pos }: { pos: THREE.Vector3 }) {
  const core = useRef<THREE.Mesh>(null);
  const halo = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    core.current?.scale.setScalar(1 + Math.sin(t * 3) * 0.08);
    if (halo.current) {
      const p = (t * 0.6) % 1;
      halo.current.scale.setScalar(1 + p * 2.2);
      (halo.current.material as THREE.MeshBasicMaterial).opacity = 0.35 * (1 - p);
    }
  });
  return (
    <group position={pos}>
      <mesh ref={core}>
        <icosahedronGeometry args={[0.2, 1]} />
        <meshStandardMaterial color={RED} emissive={RED} emissiveIntensity={1.3} flatShading />
      </mesh>
      <mesh ref={halo}>
        <sphereGeometry args={[0.22, 24, 24]} />
        <meshBasicMaterial color={RED} transparent opacity={0.3} depthWrite={false} wireframe />
      </mesh>
    </group>
  );
}

function Spoke({ from, to, match, device }: { from: THREE.Vector3; to: THREE.Vector3; match: number | null; device: boolean }) {
  const ref = useRef<any>(null); // eslint-disable-line @typescript-eslint/no-explicit-any
  useFrame((_, dt) => {
    const mat = ref.current?.material;
    if (device && mat?.uniforms?.dashOffset) mat.uniforms.dashOffset.value -= dt * 0.6;
  });
  const strength = match == null ? 0.5 : Math.max(0.25, match / 100);
  return (
    <Line
      ref={ref}
      points={[from, to]}
      color={RED}
      lineWidth={1 + strength * 2.5}
      transparent
      opacity={0.35 + strength * 0.6}
      dashed={device}
      dashScale={8}
      dashSize={0.4}
      gapSize={0.3}
    />
  );
}

export const Rings3D: React.FC<{ rings: RentalRing[]; height?: number | string }> = ({ rings, height = 520 }) => {
  const placed = useMemo(() => layout(rings), [rings]);
  const labelEls = useRef(new Map<string, HTMLElement | null>());
  const anchors = useMemo<LabelAnchor[]>(
    () =>
      placed.flatMap((l) => [
        { key: `renter:${l.ring.ring_id}`, at: (o: THREE.Vector3) => o.copy(l.centre).add(new THREE.Vector3(0, 0.45, 0)) },
        ...l.accounts.map((a) => ({ key: `acct:${l.ring.ring_id}:${a.id}`, at: (o: THREE.Vector3) => o.copy(a.pos).add(new THREE.Vector3(0, -0.22, 0)) })),
      ]),
    [placed],
  );

  // strongest evidence between the renter and each account = best edge touching that account
  const spokeInfo = (ring: RentalRing, id: string) => {
    const edges = ring.evidence.filter((e) => e.a === id || e.b === id);
    const match = Math.max(-1, ...edges.map((e) => e.behaviour_match ?? -1));
    return { match: match < 0 ? null : match, device: edges.some((e) => e.shared_devices.length > 0) };
  };

  return (
    <div className="relative overflow-hidden" style={{ height }}>
      <Canvas camera={{ position: [0, 3.2, 4.6], fov: 45 }} dpr={[1, 2]}>
        <color attach="background" args={['#0b0b0a']} />
        <ambientLight intensity={0.4} />
        <pointLight position={[3, 4, 3]} intensity={40} />
        {placed.map((l) => (
          <group key={l.ring.ring_id}>
            <Renter pos={l.centre} />
            {l.accounts.map((a) => {
              const info = spokeInfo(l.ring, a.id);
              return (
                <group key={a.id}>
                  <Spoke from={l.centre} to={a.pos} match={info.match} device={info.device} />
                  <mesh position={a.pos}>
                    <sphereGeometry args={[0.1, 20, 20]} />
                    <meshStandardMaterial color={ACCOUNT} emissive={ACCOUNT} emissiveIntensity={0.25} />
                  </mesh>
                </group>
              );
            })}
          </group>
        ))}
        <Sparkles count={40} scale={8} size={1.2} speed={0.2} opacity={0.3} color={RED} />
        <LabelProjector anchors={anchors} elements={labelEls} />
        <OrbitControls enablePan={false} minDistance={2.5} maxDistance={12} autoRotate autoRotateSpeed={0.5} />
      </Canvas>

      <div className="pointer-events-none absolute inset-0">
        {placed.map((l) => (
          <React.Fragment key={l.ring.ring_id}>
            <div ref={registerLabel(labelEls, `renter:${l.ring.ring_id}`)} className="invisible absolute left-0 top-0 whitespace-nowrap text-center">
              <div className="font-serif text-[18px] italic leading-none text-[#ff6b86] [text-shadow:0_1px_8px_#0b0b0a]">Unknown person</div>
              <div className="mt-1 font-mono text-[10px] text-mute">{l.ring.ring_id} · {l.ring.accounts.length} accounts</div>
            </div>
            {l.accounts.map((a) => (
              <div key={a.id} ref={registerLabel(labelEls, `acct:${l.ring.ring_id}:${a.id}`)} className="invisible absolute left-0 top-0 whitespace-nowrap text-center">
                <div className="text-[12px] text-paper [text-shadow:0_1px_8px_#0b0b0a]">{a.name}</div>
                <div className="font-mono text-[10px] text-dim">{a.id}</div>
              </div>
            ))}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};
