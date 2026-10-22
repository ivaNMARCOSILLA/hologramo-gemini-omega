"use client";

import { useMemo, useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

import { createAlonsoGeometry } from "../lib/alonsoGeometry";

export default function AlonsoHologram() {
  const group = useRef<THREE.Group>(null);

  const geometry = useMemo(
    () => createAlonsoGeometry(),
    []
  );

  useEffect(() => {
    return () => geometry.dispose();
  }, [geometry]);

  useFrame(({ clock }, delta) => {
    if (!group.current) return;

    group.current.rotation.y += delta * 0.12;
    group.current.rotation.x =
      Math.sin(clock.elapsedTime * 0.18) * 0.18;
  });

  return (
    <group ref={group} scale={0.85}>
      <lineSegments geometry={geometry}>
        <lineBasicMaterial
          color="#ffda00"
          transparent
          opacity={0.9}
        />
      </lineSegments>

      <lineSegments geometry={geometry} scale={1.012}>
        <lineBasicMaterial
          color="#ffc400"
          transparent
          opacity={0.25}
          depthWrite={false}
        />
      </lineSegments>
    </group>
  );
}

