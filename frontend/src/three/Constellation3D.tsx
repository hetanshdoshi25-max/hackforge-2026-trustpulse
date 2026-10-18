import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Grid, OrbitControls, QuadraticBezierLine } from '@react-three/drei';
import { LabelProjector, type LabelAnchor } from './LabelProjector';
import { registerLabel } from './labels';
import * as THREE from 'three';
import type { Session } from '../types/api';
import { getActionHex, getActionMeta } from '../utils/status';

/**
 * Live fleet as a constellation of cities. No national outline on purpose:
 * cities are placed by real lat/lon, riders orbit their city's hub.
 *   pillar height = session risk · colour = engine action (always labelled in the legend)
 *   red shockwave  = a rider just escalated to step-up / review
 *   arc            = a rider's latest login came from a different city
 */

const SCALE = 0.13;
const FIT_RADIUS = 1.7;
const HUB_LABEL_OFFSET = new THREE.Vector3(0, 0, 0.42);
const MIN_HUB_GAP = 0.78;
const ESCALATED = new Set(['STEP_UP', 'REVIEW']);

function hash(s: string, seed = 0): number {
  let h = 2166136261 ^ seed;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return ((h >>> 0) % 10000) / 10000;
}

interface Hub {
  city: string;
  pos: THREE.Vector3;
  /** label sits south of the hub, or north when a neighbour hub is close below it */
  labelOffset: THREE.Vector3;
  riders: number;
  escalated: number;
}

interface Placed {
  session: Session;
  pos: THREE.Vector3;
}

function latestPerRider(sessions: Session[]): Session[] {
  const best = new Map<string, Session>();
  for (const s of sessions) {
    const cur = best.get(s.rider_id);
    if (!cur || s.received_at > cur.received_at) best.set(s.rider_id, s);
  }
  return [...best.values()].filter((s) => s.lat != null && s.lon != null);
}

function useLayout(sessions: Session[]) {
  return useMemo(() => {
    const latest = latestPerRider(sessions);
    const byCity = new Map<string, Session[]>();
    for (const s of latest) {
      const k = s.city || `${s.lat!.toFixed(1)},${s.lon!.toFixed(1)}`;
      byCity.set(k, [...(byCity.get(k) ?? []), s]);
    }
    const raw = [...byCity.entries()].map(([city, list]) => ({
      city,
      lat: list.reduce((a, s) => a + s.lat!, 0) / list.length,
      lon: list.reduce((a, s) => a + s.lon!, 0) / list.length,
      list,
    }));
    const cLat = raw.length ? raw.reduce((a, h) => a + h.lat, 0) / raw.length : 22;
    const cLon = raw.length ? raw.reduce((a, h) => a + h.lon, 0) / raw.length : 79;
    // Fit whatever cities are present into the view (a 2-city fleet shouldn't look tiny).
    const extent = Math.max(0.5, ...raw.map((h) => Math.hypot(h.lon - cLon, h.lat - cLat)));
    const k = Math.min(SCALE, FIT_RADIUS / extent);
    const toXZ = (lat: number, lon: number) => new THREE.Vector3((lon - cLon) * k, 0, -(lat - cLat) * k);

    // True geography first, then nudge apart hubs that would overlap (Mumbai/Pune are
    // only 120 km apart): a few relaxation passes keep every city near its real spot.
    const hubXZ = raw.map((h) => toXZ(h.lat, h.lon));
    for (let iter = 0; iter < 40; iter++) {
      for (let i = 0; i < hubXZ.length; i++) {
        for (let j = i + 1; j < hubXZ.length; j++) {
          const d = hubXZ[j].clone().sub(hubXZ[i]);
          const len = d.length() || 1e-3;
          if (len >= MIN_HUB_GAP) continue;
          const push = d.normalize().multiplyScalar((MIN_HUB_GAP - len) / 2);
          hubXZ[i].sub(push);
          hubXZ[j].add(push);
        }
      }
    }

    const hubs: Hub[] = [];
    const placed: Placed[] = [];
    for (const [idx, h] of raw.entries()) {
      const pos = hubXZ[idx];
      hubs.push({
        city: h.city,
        pos,
        labelOffset: HUB_LABEL_OFFSET,
        riders: h.list.length,
        escalated: h.list.filter((s) => ESCALATED.has(s.action)).length,
      });
      for (const s of h.list) {
        const a = hash(s.rider_id) * Math.PI * 2;
        const r = 0.09 + hash(s.rider_id, 7) * 0.2;
        placed.push({ session: s, pos: pos.clone().add(new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r)) });
      }
    }
    // Close neighbours (e.g. Mumbai/Pune): the northern one labels above itself.
    for (const h of hubs) {
      const nearSouth = hubs.some((o) => o !== h && o.pos.distanceTo(h.pos) < 0.8 && o.pos.z > h.pos.z);
      if (nearSouth) h.labelOffset = HUB_LABEL_OFFSET.clone().negate();
    }
    return { hubs, placed, hubPos: new Map(hubs.map((h) => [h.city, h.pos])) };
  }, [sessions]);
}

function pillarHeight(risk: number) {
  return 0.04 + (risk / 100) * 0.75;
}

function Pillar({
  placed,
  selected,
  hover,
  onHover,
  onSelect,
}: {
  placed: Placed;
  selected: boolean;
  hover: boolean;
  onHover: (riderId: string | null) => void;
  onSelect?: (s: Session) => void;
}) {
  const { session, pos } = placed;
  const body = useRef<THREE.Mesh>(null);
  const cap = useRef<THREE.Mesh>(null);
  const h = useRef(0.02);
  const hex = getActionHex(session.action);
  const color = useMemo(() => new THREE.Color(hex), [hex]);
  const target = pillarHeight(session.risk);
  const alarm = ESCALATED.has(session.action);

  useFrame(({ clock }, dt) => {
    h.current = THREE.MathUtils.damp(h.current, target, 4, dt);
    if (body.current) {
      body.current.scale.set(1, h.current, 1);
      body.current.position.set(pos.x, h.current / 2, pos.z);
      (body.current.material as THREE.MeshBasicMaterial).color.lerp(color, Math.min(1, dt * 5));
    }
    if (cap.current) {
      const pulse = alarm ? 1 + Math.sin(clock.getElapsedTime() * 8) * 0.35 : 1;
      cap.current.position.set(pos.x, h.current, pos.z);
      cap.current.scale.setScalar((selected || hover ? 1.7 : 1) * pulse);
      (cap.current.material as THREE.MeshBasicMaterial).color.lerp(color, Math.min(1, dt * 5));
    }
  });

  return (
    <group
      onPointerOver={(e) => {
        e.stopPropagation();
        onHover(session.rider_id);
        document.body.style.cursor = 'pointer';
      }}
      onPointerOut={() => {
        onHover(null);
        document.body.style.cursor = '';
      }}
      onClick={(e) => {
        e.stopPropagation();
        onSelect?.(session);
      }}
    >
      <mesh ref={body}>
        <cylinderGeometry args={[0.011, 0.011, 1, 8]} />
        <meshBasicMaterial color={hex} transparent opacity={0.85} />
      </mesh>
      <mesh ref={cap}>
        <sphereGeometry args={[0.024, 14, 14]} />
        <meshBasicMaterial color={hex} />
      </mesh>
      {/* generous invisible hit target */}
      <mesh position={[pos.x, 0.2, pos.z]} visible={false}>
        <cylinderGeometry args={[0.05, 0.05, 0.5, 6]} />
      </mesh>
    </group>
  );
}

function HubMark({ hub }: { hub: Hub }) {
  const ring = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (ring.current) ring.current.rotation.z = clock.getElapsedTime() * 0.4;
  });
  const hot = hub.escalated > 0;
  return (
    <group position={hub.pos}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.002, 0]}>
        <circleGeometry args={[0.34, 48]} />
        <meshBasicMaterial color={hot ? '#e11d48' : '#edebe6'} transparent opacity={0.035} depthWrite={false} />
      </mesh>
      <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.004, 0]}>
        <ringGeometry args={[0.3, 0.315, 48, 1, 0, Math.PI * 1.6]} />
        <meshBasicMaterial color={hot ? '#e11d48' : '#edebe6'} transparent opacity={0.4} depthWrite={false} />
      </mesh>
    </group>
  );
}

interface FxEvent {
  id: number;
  kind: 'shock' | 'arc';
  pos: THREE.Vector3;
  to?: THREE.Vector3;
  born: number;
}

function Shock({ pos }: { pos: THREE.Vector3 }) {
  const ref = useRef<THREE.Mesh>(null);
  const t0 = useRef<number | null>(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    if (t0.current === null) t0.current = clock.getElapsedTime();
    const p = Math.min(1, (clock.getElapsedTime() - t0.current) / 1.6);
    ref.current.scale.setScalar(0.05 + p * 0.6);
    (ref.current.material as THREE.MeshBasicMaterial).opacity = 0.8 * (1 - p);
  });
  return (
    <mesh ref={ref} position={[pos.x, 0.01, pos.z]} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[0.9, 1, 64]} />
      <meshBasicMaterial color="#e11d48" transparent opacity={0.8} depthWrite={false} side={THREE.DoubleSide} />
    </mesh>
  );
}

function Arc({ from, to }: { from: THREE.Vector3; to: THREE.Vector3 }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ref = useRef<any>(null);
  const mid = useMemo(() => from.clone().lerp(to, 0.5).setY(from.distanceTo(to) * 0.45 + 0.2), [from, to]);
  useFrame((_, dt) => {
    const mat = ref.current?.material;
    if (mat?.uniforms?.dashOffset) mat.uniforms.dashOffset.value -= dt * 0.8;
  });
  return (
    <QuadraticBezierLine ref={ref} start={from} end={to} mid={mid} color="#bdbab2" lineWidth={1.4} dashed dashScale={12} dashSize={0.5} gapSize={0.4} />
  );
}

function Effects({ placed, hubPos }: { placed: Placed[]; hubPos: Map<string, THREE.Vector3> }) {
  const prev = useRef(new Map<string, { action: string; city: string | null; sid: string }>());
  const [events, setEvents] = useState<FxEvent[]>([]);
  const nextId = useRef(1);

  useEffect(() => {
    const now = performance.now();
    const fresh: FxEvent[] = [];
    for (const { session: s, pos } of placed) {
      const before = prev.current.get(s.rider_id);
      if (before && before.sid !== s.session_id) {
        if (ESCALATED.has(s.action) && !ESCALATED.has(before.action)) {
          fresh.push({ id: nextId.current++, kind: 'shock', pos, born: now });
        }
        const from = before.city ? hubPos.get(before.city) : undefined;
        const to = s.city ? hubPos.get(s.city) : undefined;
        if (from && to && before.city !== s.city) {
          fresh.push({ id: nextId.current++, kind: 'arc', pos: from, to, born: now });
        }
      }
      prev.current.set(s.rider_id, { action: s.action, city: s.city, sid: s.session_id });
    }
    if (fresh.length) setEvents((e) => [...e.filter((x) => now - x.born < 7000), ...fresh]);
  }, [placed, hubPos]);

  useEffect(() => {
    if (!events.length) return;
    const t = window.setTimeout(() => setEvents((e) => e.filter((x) => performance.now() - x.born < 7000)), 2000);
    return () => window.clearTimeout(t);
  }, [events]);

  return (
    <>
      {events.map((e) =>
        e.kind === 'shock' ? <Shock key={e.id} pos={e.pos} /> : <Arc key={e.id} from={e.pos} to={e.to!} />,
      )}
    </>
  );
}

export interface Constellation3DProps {
  sessions: Session[];
  selectedSessionId?: string | null;
  onSelectSession?: (s: Session) => void;
  height?: number | string;
  autoRotate?: boolean;
}

export const Constellation3D: React.FC<Constellation3DProps> = ({
  sessions,
  selectedSessionId,
  onSelectSession,
  height = 480,
  autoRotate = true,
}) => {
  const { hubs, placed, hubPos } = useLayout(sessions);
  const [hovered, setHovered] = useState<string | null>(null);
  const labelEls = useRef(new Map<string, HTMLElement | null>());
  const focus = placed.find((p) => p.session.rider_id === hovered) ?? placed.find((p) => p.session.session_id === selectedSessionId);

  const anchors = useMemo<LabelAnchor[]>(() => {
    const list: LabelAnchor[] = hubs.map((h) => ({ key: `hub:${h.city}`, at: (o) => o.copy(h.pos).add(h.labelOffset) }));
    if (focus) {
      const y = pillarHeight(focus.session.risk) + 0.12;
      list.push({ key: 'tooltip', at: (o) => o.set(focus.pos.x, y, focus.pos.z) });
    }
    return list;
  }, [hubs, focus]);

  return (
    <div className="relative overflow-hidden" style={{ height }}>
      <Canvas camera={{ position: [0, 2.6, 3.4], fov: 42 }} dpr={[1, 2]}>
        <color attach="background" args={['#0b0b0a']} />
        <fog attach="fog" args={['#0b0b0a', 4, 9]} />
        <Grid
          infiniteGrid
          cellSize={0.13}
          sectionSize={1.3}
          cellColor="#1d1d1b"
          sectionColor="#34332f"
          cellThickness={0.6}
          sectionThickness={1}
          fadeDistance={7}
          fadeStrength={2}
          position={[0, -0.001, 0]}
        />
        {hubs.map((h) => (
          <HubMark key={h.city} hub={h} />
        ))}
        {placed.map((p) => (
          <Pillar
            key={p.session.rider_id}
            placed={p}
            selected={p.session.session_id === selectedSessionId}
            hover={p.session.rider_id === hovered}
            onHover={setHovered}
            onSelect={onSelectSession}
          />
        ))}
        <LabelProjector anchors={anchors} elements={labelEls} />
        <Effects placed={placed} hubPos={hubPos} />
        <OrbitControls
          enablePan={false}
          minDistance={1.8}
          maxDistance={6}
          maxPolarAngle={1.25}
          autoRotate={autoRotate}
          autoRotateSpeed={0.35}
        />
      </Canvas>

      {/* screen-space labels, positioned every frame by LabelProjector */}
      <div className="pointer-events-none absolute inset-0">
        {hubs.map((h) => (
          <div key={h.city} ref={registerLabel(labelEls, `hub:${h.city}`)} className="invisible absolute left-0 top-0 whitespace-nowrap text-center">
            <div className="font-serif text-[17px] leading-none text-paper [text-shadow:0_1px_8px_#0b0b0a]">{h.city}</div>
            <div className="mt-1 font-mono text-[10px] text-mute">
              {h.riders} rider{h.riders === 1 ? '' : 's'}
              {h.escalated > 0 && <span className="text-review"> · {h.escalated} flagged</span>}
            </div>
          </div>
        ))}
        {focus && (
          <div
            ref={registerLabel(labelEls, 'tooltip')}
            className="invisible absolute left-0 top-0 whitespace-nowrap border-l-2 border-paper bg-ink/95 px-3 py-1.5 text-[11px] text-paper-2"
          >
            <div className="text-[13px] text-paper">{focus.session.name}</div>
            <div className="font-mono text-mute">
              trust {focus.session.trust} · <span style={{ color: getActionHex(focus.session.action) }}>{getActionMeta(focus.session.action).label}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export const ConstellationLegend: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`flex flex-wrap items-center gap-x-5 gap-y-1.5 font-mono text-[10.5px] text-paper-2 ${className}`}>
    {(['ALLOW', 'SOFT_CHECK', 'STEP_UP', 'REVIEW', 'ENROLLING'] as const).map((a) => (
      <span key={a} className="flex items-center gap-1.5 uppercase tracking-[0.1em]">
        <span className="inline-block h-2 w-2 rounded-[1px]" style={{ background: getActionHex(a) }} />
        {getActionMeta(a).label}
      </span>
    ))}
    <span className="text-dim">pillar height = risk · ring = just escalated · dashed arc = new city</span>
  </div>
);
