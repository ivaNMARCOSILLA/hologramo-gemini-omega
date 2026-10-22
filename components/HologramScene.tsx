"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

type Props = {
  handPos: { x: number; y: number; z: number };
  isGrabbing: boolean;
  currentScale: number;
  isSpeaking: boolean;
  emotion: string;
};

function QuantumParticles() {
  const points = useRef<THREE.Points>(null);

  const positions = useMemo(() => {
    const array = new Float32Array(200 * 3);

    for (let i = 0; i < 200; i++) {
      const j = i * 3;
      array[j] = (Math.random() - 0.5) * 5;
      array[j + 1] = (Math.random() - 0.5) * 5;
      array[j + 2] = (Math.random() - 0.5) * 3;
    }

    return array;
  }, []);

  useFrame((_, delta) => {
    if (!points.current) return;

    const attribute = points.current.geometry.attributes.position as THREE.BufferAttribute;

    const array = attribute.array as Float32Array;

    for (let i = 1; i < array.length; i += 3) {
      array[i] += delta * 0.5;
      if (array[i] > 2.5) array[i] = -2.5;
    }

    attribute.needsUpdate = true;
  });

  return (
    <points ref={points}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
        />
      </bufferGeometry>
      <pointsMaterial
        color="#00f0ff"
        size={0.018}
        transparent
        opacity={0.68}
        sizeAttenuation
        depthWrite={false}
      />
    </points>
  );
}

function QuantumCore(props: Props) {
  const group = useRef<THREE.Group>(null);
  const crystal = useRef<THREE.Mesh>(null);
  const cage = useRef<THREE.LineSegments>(null);
  const ring1 = useRef<THREE.Mesh>(null);
  const ring2 = useRef<THREE.Mesh>(null);

  const cageGeometry = useMemo(() => {
    const source = new THREE.IcosahedronGeometry(0.95, 1);
    const edges = new THREE.EdgesGeometry(source);
    source.dispose();
    return edges;
  }, []);

  useEffect(() => {
    return () => cageGeometry.dispose();
  }, [cageGeometry]);

  const colors: Record<string, string> = {
    neutral: "#00f0ff",
    joy: "#ffe36a",
    calm: "#54ffe1",
    empathy: "#ff8ac8",
    curiosity: "#b29aff",
    alert: "#ff5577"
  };

  const color = colors[props.emotion] || colors.neutral;

  useFrame(({ clock }, delta) => {
    if (!group.current) return;

    const t = clock.elapsedTime;

    if (crystal.current) {
      crystal.current.rotation.x = t * 0.6;
      crystal.current.rotation.y = t * 0.8;
    }

    if (cage.current) {
      cage.current.rotation.y = -t * 0.4;
      cage.current.rotation.z = t * 0.3;
    }

    if (ring1.current) {
      ring1.current.rotation.x =
        Math.PI / 2 + Math.sin(t) * 0.3;
      ring1.current.rotation.y = t * 0.5;
    }

    if (ring2.current) {
      ring2.current.rotation.y =
        Math.PI / 3 + Math.cos(t * 0.8) * 0.3;
      ring2.current.rotation.z = t * 0.6;
    }

    const targetX = props.handPos.x * 0.25;
    const targetY =
      Math.sin(t * 1.5) * 0.12 +
      props.handPos.y * 0.25;

    group.current.position.x = THREE.MathUtils.damp(
      group.current.position.x,
      targetX,
      3,
      delta
    );

    group.current.position.y = THREE.MathUtils.damp(
      group.current.position.y,
      targetY,
      3,
      delta
    );

    const voicePulse = props.isSpeaking
      ? 1 + Math.sin(t * 6.5) * 0.20
      : 1 + Math.sin(t * 1.3) * 0.015;

    const baseScale = THREE.MathUtils.clamp(
      props.currentScale,
      0.25,
      2
    );

    const targetScale =
      1.35 *
      baseScale *
      voicePulse *
      (props.isGrabbing ? 1.12 : 1);

    const next = THREE.MathUtils.damp(
      group.current.scale.x,
      targetScale,
      5,
      delta
    );

    group.current.scale.setScalar(next);
  });

  return (
    <group ref={group}>
      <mesh ref={crystal}>
        <octahedronGeometry args={[0.7, 0]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={1.6}
          roughness={0.1}
          metalness={0.9}
          transparent
          opacity={0.85}
          flatShading
        />
      </mesh>

      <lineSegments
        ref={cage}
        geometry={cageGeometry}
      >
        <lineBasicMaterial
          color="#38bdf8"
          transparent
          opacity={0.65}
          depthWrite={false}
        />
      </lineSegments>

      <mesh ref={ring1}>
        <torusGeometry args={[1.3, 0.015, 12, 96]} />
        <meshBasicMaterial
          color="#00f0ff"
          transparent
          opacity={0.85}
        />
      </mesh>

      <mesh ref={ring2}>
        <torusGeometry args={[1.5, 0.012, 12, 96]} />
        <meshBasicMaterial
          color="#f43f5e"
          transparent
          opacity={0.75}
        />
      </mesh>
    </group>
  );
}

export default function HologramScene(props: Props) {
  return (
    <div
      className="omega-hyper-root"
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        background: "transparent",
        pointerEvents: "none"
      }}
    >
      <Canvas
        dpr={[1, 1.5]}
        gl={{ alpha: true, antialias: true }}
        camera={{
          position: [0, 0, 4.2],
          fov: 50
        }}
        style={{
          background: "transparent",
          pointerEvents: "none"
        }}
      >
        <ambientLight intensity={0.8} />
        <pointLight
          position={[0, 0, 3]}
          color="#00f0ff"
          intensity={3}
          distance={50}
        />

        <QuantumParticles />
        <QuantumCore {...props} />
      </Canvas>
    </div>
  );
}