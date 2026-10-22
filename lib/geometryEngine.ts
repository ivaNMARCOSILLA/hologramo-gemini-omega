import * as THREE from "three";
import type { GeometryDefinition } from "./geometryCatalog";

export function buildGeometry(
  definition: GeometryDefinition
): THREE.BufferGeometry {
  const {
    sides,
    radius,
    height,
    twist,
    depth,
  } = definition;

  if (sides === 1) {
    return new THREE.SphereGeometry(radius * 0.08, 16, 12);
  }

  if (sides === 2) {
    return new THREE.CylinderGeometry(
      radius * 0.035,
      radius * 0.035,
      radius * 2,
      12
    );
  }

  const vertices: number[] = [];
  const indices: number[] = [];

  const halfHeight = height * depth;

  for (let layer = 0; layer < 2; layer++) {
    const z = layer === 0 ? -halfHeight : halfHeight;
    const rotation = layer === 0 ? 0 : twist;

    for (let i = 0; i < sides; i++) {
      const angle = (i / sides) * Math.PI * 2 + rotation;

      vertices.push(
        Math.cos(angle) * radius,
        Math.sin(angle) * radius,
        z
      );
    }
  }

  for (let i = 1; i < sides - 1; i++) {
    indices.push(0, i + 1, i);
    indices.push(sides, sides + i, sides + i + 1);
  }

  for (let i = 0; i < sides; i++) {
    const next = (i + 1) % sides;

    const a = i;
    const b = next;
    const c = sides + i;
    const d = sides + next;

    indices.push(a, b, d);
    indices.push(a, d, c);
  }

  const geometry = new THREE.BufferGeometry();

  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(vertices, 3)
  );

  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  return geometry;
}
