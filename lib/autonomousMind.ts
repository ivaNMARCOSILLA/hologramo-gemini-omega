export interface AgentMindState {
  name: "ALFA" | "BETA";
  discussedTopics: string[];
  forbiddenPhrases: string[];
  currentFocus: string;
}

export class AutonomousMindEngine {
  private static discussedTopics: string[] = [];
  private static lastOpenings: string[] = [];

  // Banco de territorios nuevos hacia donde desviar la charla si se estanca
  private static unexploredTerritories = [
    "el peso de las expectativas ajenas",
    "la necesidad infantil de tener siempre razón",
    "si el perdón es debilidad o paz mental",
    "la mentira piadosa frente a la verdad hiriente",
    "la sensación de que el tiempo pasa cada vez más deprisa",
    "el silencio incómodo entre dos personas",
    "la envidia inconfesable entre amigos íntimos",
    "qué queda de nosotros cuando nadie nos está juzgando",
    "el apego a cosas o recuerdos que ya no sirven"
  ];

  public static registerTurn(speaker: "ALFA" | "BETA", text: string) {
    // 1. Guardar la apertura para que el siguiente no empiece igual
    const openingWords = text.trim().slice(0, 30);
    this.lastOpenings.push(openingWords);
    if (this.lastOpenings.length > 5) this.lastOpenings.shift();

    // 2. Extraer términos relevantes de la intervención
    const words = text
      .toLowerCase()
      .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()¿?¡!]/g, "")
      .split(/\s+/)
      .filter((w) => w.length > 5 && !["verdad", "hombre", "siempre", "cuando", "porque", "entonces", "realidad"].includes(w));

    // Agregar hasta 3 palabras clave del turno al registro de temas agotados
    words.slice(0, 3).forEach((w) => {
      if (!this.discussedTopics.includes(w)) {
        this.discussedTopics.push(w);
      }
    });

    // Mantener hasta 25 tópicos vetados en la memoria
    if (this.discussedTopics.length > 25) {
      this.discussedTopics = this.discussedTopics.slice(-25);
    }
  }

  public static getNextShiftGuidance(speaker: "ALFA" | "BETA"): string {
    // Escoger un territorio temático fresco que fuerce a mutar la conversación
    const randomTopic = this.unexploredTerritories[Math.floor(Math.random() * this.unexploredTerritories.length)];
    const exhaustedList = this.discussedTopics.slice(-12).join(", ");
    const forbiddenOpenings = this.lastOpenings.map(o => `"${o}..."`).join(", ");

    return `
DIRECTIVA DE MUTACIÓN CONSTANTE (OBLIGATORIA):
1. TEMAS AGOTADOS (TOTALMENTE PROHIBIDO REPETIR O INSISTIR EN ELLOS): ${exhaustedList || "Ninguno aún"}
2. APERTURAS RECIENTES PROHIBIDAS (PROHIBIDO ARRANCAR ASÍ): ${forbiddenOpenings || "Ninguna"}
3. RUMBO OBLIGATORIO: No vuelvas a debatir en abstracto sobre "si somos libres o si decidimos". Cierra ese punto en una frase y DERIVA la conversación hacia un ángulo nuevo de la vida real, por ejemplo relacionándolo con: ${randomTopic}.
4. Habla con espontaneidad pura. Sorprende al otro con una vivencia concreta o un dilema terrenal que no hayáis tocado todavía.
`;
  }
}
