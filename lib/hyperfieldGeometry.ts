import * as THREE from "three";

export function createHyperfield(
  variant: number,
  dimension: number
): THREE.BufferGeometry {
  const strands = 24;
  const steps = 160;
  const positions = new Float32Array(strands * (steps - 1) * 6);

  const a = 2 + (variant % 9);
  const b = 3 + (variant % 13);
  const c = 4 + (variant % 17);
  const d = Math.max(24, Math.min(180, dimension));

  let offset = 0;

  function point(t: number, phase: number): [number, number, number] {
    const radius =
      1.05 +
      0.32 * Math.cos(b * t + phase) +
      0.12 * Math.sin(c * t - phase);

    const twist = 0.2 * Math.sin(d * 0.03 + phase);

    return [
      radius * Math.cos(a * t + twist) +
        0.22 * Math.sin(c * t + phase),

      radius * Math.sin(a * t + twist) +
        0.22 * Math.cos(b * t - phase),

      0.72 * Math.sin(b * t + phase) +
        0.28 * Math.cos(c * t + phase)
    ];
  }

  for (let s = 0; s < strands; s++) {
    const phase = s / strands * Math.PI * 2;

    for (let i = 0; i < steps - 1; i++) {
      const t1 = i / (steps - 1) * Math.PI * 2;
      const t2 = (i + 1) / (steps - 1) * Math.PI * 2;

      const p1 = point(t1, phase);
      const p2 = point(t2, phase);

      positions.set([...p1, ...p2], offset);
      offset += 6;
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.BufferAttribute(positions, 3)
  );

  geometry.computeBoundingSphere();
  return geometry;
}

