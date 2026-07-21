import { useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, type ThreeEvent } from '@react-three/fiber';
import { Float, RoundedBox, Sparkles as DreiSparkles, Text } from '@react-three/drei';
import type { Group, Mesh } from 'three';

/**
 * Nivel B del sistema 3D (Manual_Implementacion_Diseno_Ferova_One, sec. 7):
 * escena WebGL del hero de la landing. Vive en su propia rama
 * (feat/ferova-ui-v2-3d) -- three/@react-three/* no estan en main todavia.
 *
 * Alcance de esta pasada: nucleo/orb + 4 tarjetas orbitando (Finanzas, CRM,
 * Planner, Reportes), inclinacion por cursor, auto-rotacion ambiental y
 * degradacion por FPS. El scroll-linked "separar capas y abrir demo" del
 * manual queda para una iteracion siguiente -- documentado, no fingido.
 */

const CARDS = [
  { label: 'Finanzas', color: '#2F2D56', angle: 0 },
  { label: 'CRM', color: '#541014', angle: Math.PI / 2 },
  { label: 'Planner', color: '#57524a', angle: Math.PI },
  { label: 'Reportes', color: '#C0930E', angle: (Math.PI * 3) / 2 },
] as const;

function OrbitingCard({ label, color, angle, radius, groupRef }: { label: string; color: string; angle: number; radius: number; groupRef: React.RefObject<Group | null> }) {
  const ref = useRef<Mesh>(null);
  useFrame((state) => {
    const t = state.clock.getElapsedTime() * 0.18 + angle;
    if (ref.current) {
      ref.current.position.x = Math.cos(t) * radius;
      ref.current.position.z = Math.sin(t) * radius;
      ref.current.position.y = Math.sin(t * 1.3) * 0.25;
      ref.current.lookAt(0, ref.current.position.y, 0);
    }
  });
  return (
    <Float speed={1.4} rotationIntensity={0.15} floatIntensity={0.3}>
      <group ref={ref as unknown as React.RefObject<Group>}>
        <RoundedBox args={[1.1, 0.7, 0.08]} radius={0.08} smoothness={4}>
          <meshStandardMaterial color="#FFFDF9" roughness={0.4} metalness={0.05} />
        </RoundedBox>
        <mesh position={[-0.42, 0.18, 0.05]}>
          <circleGeometry args={[0.09, 24]} />
          <meshStandardMaterial color={color} />
        </mesh>
        <Text position={[0, -0.1, 0.05]} fontSize={0.13} color="#1f1b16" anchorX="center" anchorY="middle" font={undefined}>
          {label}
        </Text>
      </group>
    </Float>
  );
}

function Core({ onPointerMove }: { onPointerMove: (e: ThreeEvent<PointerEvent>) => void }) {
  const ref = useRef<Mesh>(null);
  useFrame((state) => {
    if (ref.current) ref.current.rotation.y = state.clock.getElapsedTime() * 0.15;
  });
  return (
    <mesh ref={ref} onPointerMove={onPointerMove}>
      <icosahedronGeometry args={[0.85, 1]} />
      <meshStandardMaterial color="#C0930E" roughness={0.25} metalness={0.35} emissive="#C0930E" emissiveIntensity={0.15} />
    </mesh>
  );
}

/** Degrada (deja de animar / reduce carga) si el FPS sostenido cae bajo 45 -- presupuesto tecnico del manual. */
function useFpsGuard(): boolean {
  const [healthy, setHealthy] = useState(true);
  const framesRef = useRef(0);
  const lastCheckRef = useRef(0);
  useFrame((state) => {
    framesRef.current += 1;
    const elapsed = state.clock.getElapsedTime();
    if (elapsed - lastCheckRef.current >= 1) {
      const fps = framesRef.current / (elapsed - lastCheckRef.current);
      if (fps < 45 && healthy) setHealthy(false);
      framesRef.current = 0;
      lastCheckRef.current = elapsed;
    }
  });
  return healthy;
}

function Scene() {
  const groupRef = useRef<Group>(null);
  const target = useRef({ x: 0, y: 0 });
  const healthy = useFpsGuard();

  const handlePointerMove = (e: ThreeEvent<PointerEvent>) => {
    target.current.x = (e.point.x || 0) * 0.15;
    target.current.y = (e.point.y || 0) * 0.15;
  };

  useFrame(() => {
    if (!groupRef.current) return;
    groupRef.current.rotation.y += (target.current.x - groupRef.current.rotation.y) * 0.05;
    groupRef.current.rotation.x += (-target.current.y - groupRef.current.rotation.x) * 0.05;
  });

  const cards = useMemo(() => CARDS, []);

  return (
    <group ref={groupRef}>
      <ambientLight intensity={0.7} />
      <pointLight position={[3, 3, 3]} intensity={1.1} color="#FFFDF9" />
      <pointLight position={[-3, -2, -2]} intensity={0.4} color="#2F2D56" />
      <Core onPointerMove={handlePointerMove} />
      {healthy && <DreiSparkles count={30} scale={3.5} size={2} speed={0.25} color="#C0930E" opacity={0.5} />}
      {cards.map((card) => (
        <OrbitingCard key={card.label} label={card.label} color={card.color} angle={card.angle} radius={healthy ? 1.9 : 1.9} groupRef={groupRef} />
      ))}
    </group>
  );
}

export function ProductUniverseCanvas() {
  return (
    <Canvas
      dpr={[1, 1.5]}
      camera={{ position: [0, 0.6, 4.2], fov: 42 }}
      gl={{ antialias: true, alpha: true }}
      style={{ touchAction: 'pan-y' }}
    >
      <Scene />
    </Canvas>
  );
}

export default ProductUniverseCanvas;
