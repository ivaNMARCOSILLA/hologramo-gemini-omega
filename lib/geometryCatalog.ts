export type GeometryDefinition = {
  id: number;
  name: string;
  family: string;
  sides: number;
  variant: number;
  radius: number;
  depth: number;
  twist: number;
  height: number;
};

const families = [
  "Monógono teórico",
  "Dígono teórico",
  "Triángulo",
  "Cuadrilátero",
  "Pentágono",
  "Hexágono",
  "Heptágono",
  "Octágono",
  "Eneágono",
  "Decágono",
  "Endecágono",
  "Dodecágono",
  "Tridecágono",
  "Tetradecágono",
  "Pentadecágono",
  "Hexadecágono",
  "Heptadecágono",
  "Octadecágono",
  "Eneadecágono",
  "Icoságono",
];

export const geometryCatalog: GeometryDefinition[] =
  families.flatMap((family, familyIndex) =>
    Array.from({ length: 125 }, (_, variant) => {
      const scaleIndex = variant % 5;
      const depthIndex = Math.floor(variant / 5) % 5;
      const twistIndex = Math.floor(variant / 25);

      return {
        id: familyIndex * 125 + variant + 1,
        name: `${family} · V${String(variant + 1).padStart(3, "0")}`,
        family,
        sides: familyIndex + 1,
        variant,
        radius: 0.7 + scaleIndex * 0.18,
        depth: 0.12 + depthIndex * 0.16,
        twist: twistIndex * Math.PI / 20,
        height: 0.45 + depthIndex * 0.2,
      };
    })
  );

export function getGeometry(id: number) {
  return geometryCatalog.find((g) => g.id === id);
}
