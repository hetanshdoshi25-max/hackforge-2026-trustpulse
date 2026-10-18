import React, { useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * Landing hero: a fingerprint drawn as ~10k ridge particles. A heartbeat wave rolls out
 * from the core every few seconds. Most beats are the owner (paper white, ridges stay put);
 * every third beat is someone else: the wave turns red and the ridges tear.
 */

const CYCLE = 3.6; // seconds per beat
const ALARM_EVERY = 3;

function buildRidges(): { pos: Float32Array; rnd: Float32Array } {
  const pts: number[] = [];
  const rnd: number[] = [];
  let seed = 7;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  const rings = 38;
  for (let k = 0; k < rings; k++) {
    const r0 = 0.06 + k * 0.052;
    const n = Math.floor((Math.PI * 2 * r0) / 0.016);
    // ridge endings and bifurcations: skip a few arcs per ring
    const gaps = Array.from({ length: 1 + Math.floor(rand() * 3) }, () => [rand() * Math.PI * 2, 0.08 + rand() * 0.22]);
    for (let i = 0; i < n; i++) {
      const t = (i / n) * Math.PI * 2;
      if (gaps.some(([g, w]) => Math.abs(Math.atan2(Math.sin(t - g), Math.cos(t - g))) < w)) continue;
      // a loop pattern: rings pushed up and pinched to one side, like a real print
      const warp = 1 + 0.13 * Math.sin(2 * t + k * 0.17) + 0.06 * Math.sin(3 * t - k * 0.11);
      const r = r0 * warp;
      const x = Math.cos(t) * r * 0.82 + 0.05 * Math.sin(r0 * 3);
      const y = Math.sin(t) * r * 1.06 + 0.18 * Math.exp(-r0 * 1.2) * (1 - Math.cos(t)) * 0.4;
      pts.push(x, y, 0);
      rnd.push(rand(), rand(), rand());
    }
  }
  return { pos: new Float32Array(pts), rnd: new Float32Array(rnd) };
}

const vertex = /* glsl */ `
  attribute vec3 aRnd;
  uniform float uTime;
  uniform float uPhase;
  uniform float uAlarm;
  uniform float uDpr;
  uniform vec3 uBase;
  uniform vec3 uHot;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vec3 p = position;
    float d = length(p.xy);
    float waveR = uPhase * 2.6;
    float wave = exp(-pow((d - waveR) * 7.0, 2.0));
    float behind = smoothstep(waveR, waveR - 0.6, d) * (1.0 - uPhase);
    p.z += wave * 0.22 + sin(d * 14.0 - uTime * 1.4) * 0.01;
    // someone else: ridges tear where the wave has passed
    vec2 tear = (aRnd.xy - 0.5) * 0.16 * uAlarm * (wave + behind * 0.6);
    p.xy += tear;
    p.z += (aRnd.z - 0.5) * 0.25 * uAlarm * behind;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = (2.0 + wave * 3.0) * uDpr * (3.2 / -mv.z);
    vColor = mix(uBase, uHot, clamp(wave * 1.2 + behind * uAlarm * 0.7, 0.0, 1.0));
    vAlpha = 0.5 + wave * 0.5 + (1.0 - smoothstep(0.0, 2.2, d)) * 0.2;
  }
`;

const fragment = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float r = length(c);
    if (r > 0.5) discard;
    gl_FragColor = vec4(vColor, vAlpha * smoothstep(0.5, 0.2, r));
  }
`;

const PAPER = new THREE.Color('#edebe6');
const RED = new THREE.Color('#e11d48');
const BASE = new THREE.Color('#a29e95');

function Field({ onBeat }: { onBeat?: (n: number, alarm: boolean) => void }) {
  const { pos, rnd } = useMemo(() => buildRidges(), []);
  const group = useRef<THREE.Group>(null);
  const mat = useRef<THREE.ShaderMaterial>(null);
  const lastBeat = useRef(-1);
  const { pointer, gl } = useThree();
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uPhase: { value: 0 },
      uAlarm: { value: 0 },
      uDpr: { value: Math.min(2, gl.getPixelRatio()) },
      uBase: { value: BASE.clone() },
      uHot: { value: PAPER.clone() },
    }),
    [gl],
  );

  useFrame(({ clock }, dt) => {
    const t = clock.getElapsedTime();
    const n = Math.floor(t / CYCLE);
    const alarm = n % ALARM_EVERY === ALARM_EVERY - 1;
    if (n !== lastBeat.current) {
      lastBeat.current = n;
      onBeat?.(n, alarm);
    }
    const u = mat.current?.uniforms;
    if (!u) return;
    u.uTime.value = t;
    u.uPhase.value = (t % CYCLE) / CYCLE;
    u.uAlarm.value = THREE.MathUtils.damp(u.uAlarm.value, alarm ? 1 : 0, 6, dt);
    u.uHot.value.lerp(alarm ? RED : PAPER, Math.min(1, dt * 8));
    if (group.current) {
      group.current.rotation.x = THREE.MathUtils.damp(group.current.rotation.x, -0.55 + pointer.y * 0.18, 3, dt);
      group.current.rotation.y = THREE.MathUtils.damp(group.current.rotation.y, -0.25 + pointer.x * 0.3, 3, dt);
      group.current.rotation.z = Math.sin(t * 0.1) * 0.05;
    }
  });

  return (
    <group ref={group}>
      <points>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[pos, 3]} />
          <bufferAttribute attach="attributes-aRnd" args={[rnd, 3]} />
        </bufferGeometry>
        <shaderMaterial
          ref={mat}
          vertexShader={vertex}
          fragmentShader={fragment}
          uniforms={uniforms}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
    </group>
  );
}

export const IdentityField3D: React.FC<{ className?: string; onBeat?: (n: number, alarm: boolean) => void }> = ({ className = '', onBeat }) => {
  // keep the callback stable for the frame loop
  const cb = useRef(onBeat);
  useEffect(() => {
    cb.current = onBeat;
  }, [onBeat]);
  return (
    <div className={className}>
      <Canvas camera={{ position: [0, 0, 3.0], fov: 46 }} dpr={[1, 2]} gl={{ antialias: true, alpha: true }}>
        <Field onBeat={(n, a) => cb.current?.(n, a)} />
      </Canvas>
    </div>
  );
};

export default IdentityField3D;
