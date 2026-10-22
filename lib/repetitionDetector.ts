export interface RepetitionAudit {
  speaker: "ALFA" | "BETA";
  similarityScore: number; // Porcentaje de 0 a 100
  isRepeating: boolean;    // true si supera el umbral del 35%
  repeatedWords: string[];
  totalPastSamples: number;
}

export class RepetitionDetector {
  private static alfaHistory: string[] = [];
  private static betaHistory: string[] = [];

  // Extrae tokens relevantes (palabras significativas de más de 4 letras)
  private static tokenize(text: string): Set<string> {
    const stopWords = new Set(["hombre", "verdad", "porque", "entonces", "cuando", "siempre", "muchas", "tienes", "bueno", "mira"]);
    const cleaned = text
      .toLowerCase()
      .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()¿?¡!"]/g, "")
      .split(/\s+/)
      .filter((w) => w.length > 4 && !stopWords.has(w));
    return new Set(cleaned);
  }

  // Coeficiente de similitud de Jaccard entre dos conjuntos de palabras
  private static calculateJaccard(setA: Set<string>, setB: Set<string>): { score: number; intersection: string[] } {
    if (setA.size === 0 || setB.size === 0) return { score: 0, intersection: [] };

    const intersection: string[] = [];
    setA.forEach((word) => {
      if (setB.has(word)) intersection.push(word);
    });

    const unionSize = new Set([...setA, ...setB]).size;
    const score = unionSize === 0 ? 0 : Math.round((intersection.length / unionSize) * 100);
    return { score, intersection };
  }

  public static audit(speaker: "ALFA" | "BETA", currentText: string): RepetitionAudit {
    const history = speaker === "ALFA" ? this.alfaHistory : this.betaHistory;
    const currentTokens = this.tokenize(currentText);

    let maxSimilarity = 0;
    let mostRepeatedTokens: string[] = [];

    // Comparar contra todas las intervenciones previas del mismo hablante
    for (const previousText of history) {
      const prevTokens = this.tokenize(previousText);
      const { score, intersection } = this.calculateJaccard(currentTokens, prevTokens);

      if (score > maxSimilarity) {
        maxSimilarity = score;
        mostRepeatedTokens = intersection;
      }
    }

    // Registrar en el historial de auditoría (máximo 15 muestras acumuladas)
    history.push(currentText);
    if (history.length > 15) history.shift();

    return {
      speaker,
      similarityScore: maxSimilarity,
      isRepeating: maxSimilarity >= 35, // Umbral de redundancia
      repeatedWords: mostRepeatedTokens.slice(0, 5),
      totalPastSamples: history.length
    };
  }
}
