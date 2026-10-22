import * as THREE from "three";

export function createAlonsoGeometry(): THREE.BufferGeometry {
  const points: THREE.Vector3[] = [];

  const count = 12000;
  const turns = 42;

  for (let i = 0; i < count; i++) {
    const t = (i / (count - 1)) * Math.PI * 2 * turns;

    const r =
      1.15 +
      0.35 * Math.cos(3.1 * t) +
      0.18 * Math.sin(7.3 * t);

    const x =
      r * Math.cos(t * 0.71) +
      0.28 * Math.sin(t * 1.37);

    const y =
      r * Math.sin(t * 0.83) +
      0.22 * Math.cos(t * 1.91);

    const z =
      0.65 * Math.sin(t * 0.49) +
      0.45 * Math.cos(t * 1.13);

    points.push(
      new THREE.Vector3(x, y, z)
    );
  }

  return new THREE.BufferGeometry().setFromPoints(points);
}
