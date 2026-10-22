import * as THREE from "three";

export type StructuralFamily =
  | "toroidal"
  | "helicoidal"
  | "algebraic"
  | "saddle";

export function createStructuralGeometry(
  family: StructuralFamily,
  variant = 0
): THREE.BufferGeometry {
  const uLines = 16;
  const vLines = 12;
  const samples = 180;

  const positions: number[] = [];

  const phase = (variant % 11) * 0.11;

  function evaluate(u: number, v: number): THREE.Vector3 {
    const U = u * Math.PI * 2;
    const V = v * Math.PI * 2;

    switch (family) {
      case "toroidal": {
        const major = 1.05;
        const minor = 0.34 + 0.06 * Math.sin(5 * U + phase);

        return new THREE.Vector3(
          (major + minor * Math.cos(V)) * Math.cos(U),
          (major + minor * Math.cos(V)) * Math.sin(U),
          minor * Math.sin(V)
        );
      }

      case "helicoidal": {
        const radius = 0.25 + 0.95 * v;
        const angle = U * 2.5 + phase;

        return new THREE.Vector3(
          radius * Math.cos(angle),
          (u - 0.5) * 2.5,
          radius * Math.sin(angle)
        );
      }

      case "algebraic": {
        const x = (u - 0.5) * 2.2;
        const y = (v - 0.5) * 2.2;

        const z =
          0.48 * Math.sin(2.8 * x + phase) *
          Math.cos(2.5 * y) +
          0.14 * Math.sin(4 * x * y);

        return new THREE.Vector3(x, z, y);
      }

      case "saddle": {
        const x = (u - 0.5) * 2.1;
        const y = (v - 0.5) * 2.1;

        const z =
          0.42 * (x * x - y * y) +
          0.12 * Math.sin(3 * x * y + phase);

        return new THREE.Vector3(x, z, y);
      }
    }
  }

  function addCurve(
    fixed: number,
    alongU: boolean
  ) {
    let previous: THREE.Vector3 | null = null;

    for (let i = 0; i <= samples; i++) {
      const t = i / samples;

      const point = alongU
        ? evaluate(t, fixed)
        : evaluate(fixed, t);

      if (previous) {
        positions.push(
          previous.x, previous.y, previous.z,
          point.x, point.y, point.z
        );
      }

      previous = point;
    }
  }

  for (let i = 0; i < uLines; i++) {
    addCurve(i / uLines, true);
  }

  for (let j = 0; j < vLines; j++) {
    addCurve(j / vLines, false);
  }

  const geometry = new THREE.BufferGeometry();

  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3)
  );

  geometry.computeBoundingSphere();

  return geometry;
}
