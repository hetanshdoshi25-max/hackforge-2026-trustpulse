import React, { useRef, useMemo } from 'react';
import { Canvas, useFrame, type ThreeEvent } from '@react-three/fiber';
import { OrbitControls, Html } from '@react-three/drei';
import * as THREE from 'three';
import type { Session } from '../../types/api';
import { getRiskColor } from '../../utils/status';

interface FleetSceneProps {
  sessions: Session[];
  selectedSession: Session | null;
  onSelectSession: (session: Session) => void;
}

// Convert lat/lon to 3D Cartesian coords on a globe of radius R
function latLonToVector3(lat: number, lon: number, radius: number): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  const x = -(radius * Math.sin(phi) * Math.cos(theta));
  const z = radius * Math.sin(phi) * Math.sin(theta);
  const y = radius * Math.cos(phi);
  return new THREE.Vector3(x, y, z);
}

const RiderMarker: React.FC<{
  session: Session;
  position: THREE.Vector3;
  isSelected: boolean;
  onSelect: (session: Session) => void;
}> = ({ session, position, isSelected, onSelect }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const color = useMemo(() => getRiskColor(session.risk), [session.risk]);

  // Subtle pulsing animation
  useFrame(({ clock }) => {
    if (meshRef.current) {
      const scale = isSelected
        ? 1.4 + Math.sin(clock.getElapsedTime() * 4) * 0.2
        : 1.0 + Math.sin(clock.getElapsedTime() * 2 + session.risk) * 0.15;
      meshRef.current.scale.set(scale, scale, scale);
    }
  });

  return (
    <group position={position}>
      {/* Visual marker sphere */}
      <mesh
        ref={meshRef}
        onClick={(e: ThreeEvent<MouseEvent>) => {
          e.stopPropagation();
          onSelect(session);
        }}
        cursor="pointer"
      >
        <sphereGeometry args={[isSelected ? 0.08 : 0.05, 16, 16]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={isSelected ? 0.9 : 0.5}
          roughness={0.2}
        />
      </mesh>

      {/* Vertical beam connecting to surface */}
      <line>
        <bufferGeometry
          attach="geometry"
          onUpdate={(geo: THREE.BufferGeometry) => {
            geo.setFromPoints([new THREE.Vector3(0, 0, 0), position.clone().normalize().multiplyScalar(-0.1)]);
          }}
        />
        <lineBasicMaterial attach="material" color={color} opacity={0.6} transparent />
      </line>

      {/* Label for selected marker */}
      {isSelected && (
        <Html distanceFactor={12} position={[0, 0.12, 0]} center>
          <div className="bg-slate-900/90 border border-slate-700 px-2 py-1 rounded text-[11px] font-mono text-white whitespace-nowrap shadow-xl pointer-events-none">
            <span className="font-bold text-cyan-400">{session.name}</span> · {session.city || 'Unknown'} ·{' '}
            <span style={{ color }}>{session.trust} Trust</span>
          </div>
        </Html>
      )}
    </group>
  );
};

const Globe: React.FC = () => {
  const globeRef = useRef<THREE.Mesh>(null);

  useFrame(() => {
    if (globeRef.current) {
      globeRef.current.rotation.y += 0.0008;
    }
  });

  return (
    <group>
      {/* Inner tactical globe */}
      <mesh ref={globeRef}>
        <sphereGeometry args={[2.5, 48, 48]} />
        <meshStandardMaterial
          color="#081020"
          roughness={0.8}
          metalness={0.2}
          wireframe={false}
        />
      </mesh>

      {/* Subtle coordinate wireframe grid overlay */}
      <mesh>
        <sphereGeometry args={[2.505, 24, 24]} />
        <meshBasicMaterial
          color="#1e2c47"
          wireframe={true}
          transparent={true}
          opacity={0.35}
        />
      </mesh>

      {/* Outer atmospheric aura ring */}
      <mesh>
        <sphereGeometry args={[2.55, 32, 32]} />
        <meshBasicMaterial
          color="#06b6d4"
          wireframe={true}
          transparent={true}
          opacity={0.08}
        />
      </mesh>
    </group>
  );
};

export const FleetScene: React.FC<FleetSceneProps> = ({
  sessions,
  selectedSession,
  onSelectSession,
}) => {
  // Compute 3D positions for sessions
  const markers = useMemo(() => {
    return sessions.map((session, index) => {
      let pos: THREE.Vector3;
      if (session.lat !== null && session.lat !== undefined && session.lon !== null && session.lon !== undefined) {
        pos = latLonToVector3(session.lat, session.lon, 2.58);
      } else {
        // Schematic ring for unknown lat/lon
        const angle = (index / Math.max(sessions.length, 1)) * Math.PI * 2;
        pos = new THREE.Vector3(Math.cos(angle) * 3.1, (Math.sin(angle) * 0.4), Math.sin(angle) * 3.1);
      }
      return { session, position: pos };
    });
  }, [sessions]);

  return (
    <div className="w-full h-full min-h-[480px] relative bg-[#040812] rounded-xl overflow-hidden border border-[#1e2c47]">
      <Canvas
        camera={{ position: [0, 1.8, 5.2], fov: 45 }}
        style={{ width: '100%', height: '100%' }}
      >
        <ambientLight intensity={0.6} />
        <pointLight position={[10, 10, 10]} intensity={1.2} />
        <pointLight position={[-10, -10, -10]} intensity={0.4} color="#06b6d4" />

        <Globe />

        {markers.map(({ session, position }) => (
          <RiderMarker
            key={session.session_id}
            session={session}
            position={position}
            isSelected={selectedSession?.session_id === session.session_id}
            onSelect={onSelectSession}
          />
        ))}

        <OrbitControls
          enablePan={false}
          minDistance={3.2}
          maxDistance={8.0}
          dampingFactor={0.05}
          rotateSpeed={0.6}
        />
      </Canvas>

      {/* Tactical overlay HUD info */}
      <div className="absolute top-3 left-3 bg-slate-900/80 backdrop-blur-sm border border-slate-800 rounded-lg p-2.5 text-xs font-mono text-slate-300 pointer-events-none">
        <div className="text-cyan-400 font-bold text-[11px] uppercase tracking-wider mb-1 flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
          Tactical Spatial Globe
        </div>
        <div className="text-[10px] text-slate-400 space-y-0.5">
          <div>Plotted Sessions: <span className="text-slate-200">{sessions.length}</span></div>
          <div>Drag: Rotate · Scroll: Zoom</div>
        </div>
      </div>
    </div>
  );
};
