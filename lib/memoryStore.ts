import fs from "fs";
import path from "path";

export interface EpisodicMemory {
  id: string;
  speaker: "ALFA" | "BETA";
  confessionOrThesis: string;
  topic: string;
  timestamp: number;
}

const MEMORY_FILE = path.join(process.cwd(), "memory_state.json");

export class MemoryStore {
  private static memories: EpisodicMemory[] = [];

  // Inicializar cargando desde disco si existe
  private static load() {
    if (this.memories.length === 0) {
      try {
        if (fs.existsSync(MEMORY_FILE)) {
          const raw = fs.readFileSync(MEMORY_FILE, "utf-8");
          this.memories = JSON.parse(raw);
        }
      } catch (err) {
        this.memories = [];
      }
    }
  }

  // Guardar en memoria y persistir en disco local
  private static save() {
    try {
      fs.writeFileSync(MEMORY_FILE, JSON.stringify(this.memories, null, 2), "utf-8");
    } catch (err) {
      // Ignorar en entornos de solo lectura (como Vercel Serverless temporal)
    }
  }

  // Extrae y almacena la idea nuclear de la intervención
  public static recordMemory(speaker: "ALFA" | "BETA", fullText: string) {
    this.load();

    // Filtro para extraer frases con postura clara
    const cleanText = fullText.replace(/\n/g, " ").trim();
    if (cleanText.length < 30) return;

    // Guardar los primeros 160 caracteres representativos de la postura
    const insight = cleanText.slice(0, 180);

    const memoryItem: EpisodicMemory = {
      id: Math.random().toString(36).substring(2, 9),
      speaker,
      confessionOrThesis: insight,
      topic: cleanText.split(" ")[3] || "convicción",
      timestamp: Date.now()
    };

    this.memories.push(memoryItem);

    // Mantener hasta 30 recuerdos acumulados
    if (this.memories.length > 30) {
      this.memories.shift();
    }

    this.save();
  }

  // Recupera recuerdos relevantes del otro interlocutor para usarlos como argumento
  public static recallMemoriesAbout(targetSpeaker: "ALFA" | "BETA"): string {
    this.load();
    const targetMemories = this.memories.filter((m) => m.speaker === targetSpeaker);

    if (targetMemories.length === 0) {
      return "Aún no tienes recuerdos acumulados de conversaciones previas sobre esta entidad.";
    }

    // Tomar los 3 recuerdos más significativos para confrontar o apoyar
    const recalled = targetMemories.slice(-3).map((m, idx) => {
      return `${idx + 1}. Afirmó: "${m.confessionOrThesis}..."`;
    });

    return `\nRECUERDOS QUE GUARDAS EN TU MEMORIA SOBRE LO QUE DIJO ${targetSpeaker}:\n${recalled.join("\n")}\nUsa estos recuerdos reales de forma natural para demostrarle que te acuerdas de lo que te contó y comprobar si mantiene su postura o cambia de opinión.`;
  }
}
