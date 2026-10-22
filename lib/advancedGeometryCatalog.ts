export type AdvancedGeometry = {
  id: number;
  name: string;
  category: "matematica" | "hiperdimensional" | "experimental";
  dimension: number;
  kind: string;
  description: string;
};

const knownNames = [
  "Tetraedro","Cubo","Octaedro","Dodecaedro","Icosaedro",
  "Prisma triangular","Prisma pentagonal","Prisma hexagonal",
  "Prisma octagonal","Prisma decagonal",
  "Antiprisma triangular","Antiprisma cuadrado",
  "Antiprisma pentagonal","Antiprisma hexagonal",
  "Pirámide triangular","Pirámide cuadrada",
  "Pirámide pentagonal","Bipirámide triangular",
  "Bipirámide pentagonal","Trapezoedro",
  "Cuboctaedro","Icosidodecaedro",
  "Tetraedro truncado","Cubo truncado",
  "Octaedro truncado","Dodecaedro truncado",
  "Icosaedro truncado","Cuboctaedro truncado",
  "Icosidodecaedro truncado","Rombicuboctaedro",
  "Rombicosidodecaedro","Cubo romo","Dodecaedro romo",
  "Triacontaedro rómbico","Dodecaedro rómbico",
  "Disdiaquis triacontaedro","Triaquis tetraedro",
  "Triaquis octaedro","Tetraquis hexaedro",
  "Deltoidal icositetraedro","Pentagonal icositetraedro",
  "Toro","Toroide elíptico","Esfera",
  "Elipsoide","Paraboloide hiperbólico",
  "Hiperboloide de una hoja","Catenoide",
  "Helicoide","Superficie de Enneper"
];

const known: AdvancedGeometry[] = knownNames.map((name, i) => ({
  id: 2501 + i,
  name,
  category: "matematica",
  dimension: 3,
  kind: i < 5 ? "platonic" : i < 41 ? "polyhedron" : "surface",
  description: "Geometría matemática conocida"
}));

const hyper: AdvancedGeometry[] = Array.from(
  { length: 36 },
  (_, i) => {
    const dimension = 24 + Math.floor(i * 156 / 35);
    const kind = ["simplex","hypercube","orthoplex"][i % 3];

    return {
      id: 2551 + i,
      name: `${dimension}D · ${kind}`,
      category: "hiperdimensional",
      dimension,
      kind,
      description: "Proyección visual de una familia matemática de alta dimensión"
    };
  }
);

const experimental: AdvancedGeometry[] = Array.from(
  { length: 20 },
  (_, i) => ({
    id: 2587 + i,
    name: `${i % 2 === 0 ? "Materia" : "Antimateria"} · Omega ${String(i + 1).padStart(2,"0")}`,
    category: "experimental",
    dimension: 24 + i * 8,
    kind: i % 2 === 0 ? "matter" : "antimatter",
    description: "Diseño especulativo inspirado en conceptos físicos"
  })
);

export const advancedGeometryCatalog: AdvancedGeometry[] = [
  ...known,
  ...hyper,
  ...experimental
];
