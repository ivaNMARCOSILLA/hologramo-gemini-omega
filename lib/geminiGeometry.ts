import * as THREE from "three";

export const GEMINI_FIGURES = [
  "Esfera armónica",
  "Escalera helicoidal esférica",
  "Puente de torsión",
  "Cúpula geodésica",
  "Toroide modulado",
  "Arco de revolución",
  "Catenoide",
  "Helicoide reglado",
  "Superficie de Enneper",
  "Inmersión tipo Klein",
  "Silla hiperbólica",
  "Pseudoesfera",
  "Ondulación paramétrica"
] as const;

export function createGeminiGeometry(
  figure: number
): THREE.BufferGeometry {

  const kind = ((figure % 13) + 13) % 13;

  // Ecuaciones conservadas del código compartido.
  function evalP(u: number, v: number): THREE.Vector3 {
    const su = (u - 0.5) * 2.0;
    const sv = (v - 0.5) * 2.0;
    const aU = u * Math.PI * 2;
    const aV = v * Math.PI * 2;

    switch (kind) {
      case 0: {
        const r = 1.1 + 0.25 * Math.sin(aU * 4) * Math.cos(aV * 3);
        return new THREE.Vector3(
          r * Math.sin(v * Math.PI) * Math.cos(aU),
          r * Math.cos(v * Math.PI),
          r * Math.sin(v * Math.PI) * Math.sin(aU)
        );
      }

      case 1: {
        const turns = 4;
        const theta = u * Math.PI * 2 * turns;
        const r = 0.5 + 0.6 * Math.sin(v * Math.PI);
        const y = (v - 0.5) * 2.2;
        return new THREE.Vector3(
          (r + 0.2 * Math.cos(theta * 6)) * Math.cos(theta),
          y,
          (r + 0.2 * Math.cos(theta * 6)) * Math.sin(theta)
        );
      }

      case 2: {
        const x = su * 1.5;
        const arch = Math.cos(su * Math.PI * 0.5) * 0.8;
        const z = sv * 0.5 + Math.sin(x * 3) * 0.2;
        return new THREE.Vector3(
          x,
          arch + Math.sin(sv * Math.PI) * 0.1,
          z
        );
      }

      case 3: {
        const pV = Math.max(0, v) * Math.PI * 0.5;
        const r = 1.25 + 0.15 * Math.cos(aU * 6);
        return new THREE.Vector3(
          r * Math.sin(pV) * Math.cos(aU),
          r * Math.cos(pV),
          r * Math.sin(pV) * Math.sin(aU)
        );
      }

      case 4: {
        const R = 1.0;
        const r = 0.45 + 0.15 * Math.sin(aU * 3);
        return new THREE.Vector3(
          (R + r * Math.cos(aV)) * Math.cos(aU),
          (R + r * Math.cos(aV)) * Math.sin(aU),
          r * Math.sin(aV)
        );
      }

      case 5: {
        const ang = su * Math.PI * 0.7;
        const r = 1.1 + 0.2 * Math.cos(aV * 4);
        return new THREE.Vector3(
          Math.sin(ang) * r,
          Math.cos(ang) * r,
          sv * 0.4
        );
      }

      case 6:
        return new THREE.Vector3(
          Math.cosh(sv * 0.75) * Math.cos(aU) * 0.75,
          sv * 1.15,
          Math.cosh(sv * 0.75) * Math.sin(aU) * 0.75
        );

      case 7:
        return new THREE.Vector3(
          su * Math.cos(sv * Math.PI * 2) * 1.1,
          sv * 1.4,
          su * Math.sin(sv * Math.PI * 2) * 1.1
        );

      case 8:
        return new THREE.Vector3(
          (su - Math.pow(su, 3) / 3 + su * Math.pow(sv, 2)) * 0.5,
          (sv - Math.pow(sv, 3) / 3 + sv * Math.pow(su, 2)) * 0.5,
          (Math.pow(su, 2) - Math.pow(sv, 2)) * 0.5
        );

      case 9: {
        const rK =
          0.85 +
          Math.cos(aU / 2) * Math.sin(aV) -
          Math.sin(aU / 2) * Math.sin(2 * aV);

        return new THREE.Vector3(
          rK * Math.cos(aU) * 0.7,
          (
            Math.sin(aU / 2) * Math.sin(aV) +
            Math.cos(aU / 2) * Math.sin(2 * aV)
          ) * 0.7,
          rK * Math.sin(aU) * 0.7
        );
      }

      case 10:
        return new THREE.Vector3(
          su * 1.25,
          (Math.pow(su, 2) - Math.pow(sv, 2)) * 0.85,
          sv * 1.25
        );

      case 11: {
        const clV = Math.max(0.08, Math.min(0.92, v));
        const tU = clV * Math.PI * 1.8 - Math.PI * 0.9;
        const rT = 1.0 / Math.cosh(tU);

        return new THREE.Vector3(
          rT * Math.cos(aU) * 1.2,
          (tU - Math.tanh(tU)) * 1.2,
          rT * Math.sin(aU) * 1.2
        );
      }

      default: {
        const k = 4;
        const r =
          0.9 +
          0.3 * Math.sin(aU * k) *
          Math.cos(aV * (k - 1));

        return new THREE.Vector3(
          r * Math.cos(aU),
          Math.sin(aV * 2) * 0.65,
          r * Math.sin(aU)
        );
      }
    }
  }

  // Solo curvas paramétricas, sin triángulos.
  const positions: number[] = [];

  const samples = 140;
  const uCurves = 12;
  const vCurves = 10;

  function trace(fixed: number, alongU: boolean) {
    let previous: THREE.Vector3 | null = null;

    for (let i = 0; i <= samples; i++) {
      const t = i / samples;

      const current = alongU
        ? evalP(t, fixed)
        : evalP(fixed, t);

      if (previous) {
        positions.push(
          previous.x, previous.y, previous.z,
          current.x, current.y, current.z
        );
      }

      previous = current;
    }
  }

  for (let i = 0; i < uCurves; i++) {
    trace(i / (uCurves - 1), true);
  }

  for (let i = 0; i < vCurves; i++) {
    trace(i / (vCurves - 1), false);
  }

  const geometry = new THREE.BufferGeometry();

  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3)
  );

  geometry.computeBoundingSphere();

  return geometry;
}
