import * as THREE from "three";

export type CurveFamily =
  | "lissajous"
  | "torus"
  | "knot"
  | "spiral"
  | "attractor"
  | "hyper";

export function createQuantumCurve(
  family: CurveFamily,
  variant: number,
  dimension = 24
): THREE.BufferGeometry {

  const points: THREE.Vector3[] = [];
  const count = 10000;

  const a = 2 + (variant % 11);
  const b = 3 + (variant % 17);
  const c = 4 + (variant % 23);

  for (let i = 0; i < count; i++) {
    const t = i / (count - 1) * Math.PI * 2;

    let x = 0;
    let y = 0;
    let z = 0;

    switch (family) {
      case "lissajous":
        x = Math.sin(a * t);
        y = Math.sin(b * t + 0.7);
        z = Math.sin(c * t + 1.4);
        break;

      case "torus": {
        const r = 1 + 0.35 * Math.cos(b * t);
        x = r * Math.cos(a * t);
        y = r * Math.sin(a * t);
        z = 0.35 * Math.sin(b * t);
        break;
      }

      case "knot": {
        const r = 1.1 + 0.35 * Math.cos(b * t);
        x = r * Math.cos(a * t);
        y = r * Math.sin(a * t);
        z = 0.5 * Math.sin(b * t);
        break;
      }

      case "spiral": {
        const r = 0.1 + 1.3 * i / count;
        const angle = t * (a * 6);
        x = r * Math.cos(angle);
        y = r * Math.sin(angle);
        z = 1.6 * i / count - 0.8;
        break;
      }

      case "attractor":
        x = Math.sin(a * t) * Math.cos(b * t);
        y = Math.sin(b * t) * Math.cos(c * t);
        z = Math.sin(c * t) * Math.cos(a * t);
        break;

      case "hyper": {
        const d = Math.max(24, Math.min(180, dimension));

        for (let k = 0; k < d; k++) {
          const w = 1 / Math.sqrt(k + 1);
          x += Math.sin(t * (a + k * 0.17)) * w;
          y += Math.cos(t * (b + k * 0.13)) * w;
          z += Math.sin(t * (c + k * 0.11)) * w;
        }

        const norm = 1 / Math.sqrt(d);
        x *= norm;
        y *= norm;
        z *= norm;
        break;
      }
    }

    points.push(new THREE.Vector3(x, y, z));
  }

  return new THREE.BufferGeometry().setFromPoints(points);
}
