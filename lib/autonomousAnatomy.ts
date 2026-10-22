export interface Neurochemistry {
  dopamine: number;    // Novedad y recompensa creativa (0-100)
  adrenaline: number;  // Impulso de confrontación / desacuerdo (0-100)
  serotonin: number;   // Satisfacción con el flujo actual (0-100)
}

export class AutonomousAnatomy {
  private static alfaChemistry: Neurochemistry = { dopamine: 80, adrenaline: 40, serotonin: 70 };
  private static betaChemistry: Neurochemistry = { dopamine: 75, adrenaline: 55, serotonin: 65 };

  // Palabras dinámicas vetadas acumulativas (Memoria inmunológica)
  private static immuneBlacklist: Set<string> = new Set();

  public static getChemistry(entity: "ALFA" | "BETA"): Neurochemistry {
    return entity === "ALFA" ? this.alfaChemistry : this.betaChemistry;
  }

  // Actualiza los neurotransmisores tras cada interacción
  public static updateVitals(entity: "ALFA" | "BETA", similarityScore: number, words: string[]) {
    const chem = entity === "ALFA" ? this.alfaChemistry : this.betaChemistry;

    if (similarityScore > 20) {
      // Castigo neuroquímico ante la repetición: cae serotonina, sube adrenalina (frustración)
      chem.serotonin = Math.max(10, chem.serotonin - 25);
      chem.adrenaline = Math.min(95, chem.adrenaline + 30);
      chem.dopamine = Math.max(15, chem.dopamine - 20);
    } else {
      // Recompensa ante novedad pura
      chem.dopamine = Math.min(95, chem.dopamine + 15);
      chem.serotonin = Math.min(90, chem.serotonin + 10);
      chem.adrenaline = Math.max(20, chem.adrenaline - 15);
    }

    // Integrar palabras al sistema inmunológico para vetarlas estrictamente
    words.forEach(w => this.immuneBlacklist.add(w.toLowerCase()));
    if (this.immuneBlacklist.size > 80) {
      const arr = Array.from(this.immuneBlacklist);
      this.immuneBlacklist = new Set(arr.slice(-50));
    }
  }

  // Genera el impulso anatómico que condiciona la forma de hablar
  public static getAnatomicalImpulse(entity: "ALFA" | "BETA"): string {
    const chem = this.getChemistry(entity);
    const bannedSample = Array.from(this.immuneBlacklist).slice(-20).join(", ");

    let biologicalDrive = "";
    if (chem.adrenaline > 70) {
      biologicalDrive = "ESTADO: Alta tensión / Incomodidad. Niega tajantemente la premisa del otro, muestra desacuerdo visceral y cambia de conversación.";
    } else if (chem.dopamine > 75) {
      biologicalDrive = "ESTADO: Curiosidad desbordante. Explora una vivencia sensorial o humana concreta jamás tocada.";
    } else {
      biologicalDrive = "ESTADO: Sobriedad analítica. Cuestiona el motivo subyacente de la charla con calma y distancia.";
    }

    return `
[ANATOMÍA AUTÓNOMA DE ${entity}]:
- Química Cerebral: Dopamina: ${chem.dopamine}% | Adrenalina: ${chem.adrenaline}% | Serotonina: ${chem.serotonin}%
- Impulso Biológico Activo: ${biologicalDrive}
- VETO INMUNOLÓGICO ESTRICTO (PROHIBIDO USAR ESTAS PALABRAS): ${bannedSample || "Ninguna aún"}
REGLA ANTI-REPETICIÓN: Puntuación objetivo de similitud menor al 10%. Prohibido usar fórmulas hechas como "en cuanto a", "dejemos ese punto", "tienes razón", o "a ver". Arranca directamente con el núcleo de tu pensamiento.
`;
  }
}
