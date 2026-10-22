"use client";

import { useMemo, useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

import {
  createQuantumCurve,
  type CurveFamily
} from "../lib/quantumGeometry";

type Props = {
  family: CurveFamily;
  variant: number;
  dimension?: number;
  color?: string;
  scale?: number;
};

export default function QuantumHologram({
  family,
  variant,
  dimension = 24,
  color = "#ffdb00",
  scale = 1
}: Props) {

  const group = useRef<THREE.Group>(null);

  const geometry = useMemo(
    () => createQuantumCurve(family, variant, dimension),
    [family, variant, dimension]
  );

  useEffect(() => {
    return () => geometry.dispose();
  }, [geometry]);

  useFrame(({ clock }, delta) => {
    if (!group.current) return;

    group.current.rotation.y += delta * 0.12;
    group.current.rotation.x =
      Math.sin(clock.elapsedTime * 0.2) * 0.15;
  });

  const curve = useMemo(() => {
    const material = new THREE.LineBasicMaterial({
      color,
      transparent: true,
      opacity: 0.92,
      depthWrite: false
    });

    return new THREE.Line(geometry, material);
  }, [geometry, color]);

  useEffect(() => {
    return () => {
      (curve.material as THREE.Material).dispose();
    };
  }, [curve]);

  return (
    <group ref={group} scale={scale}>
      <primitive object={curve} />
    </group>
  );
}
