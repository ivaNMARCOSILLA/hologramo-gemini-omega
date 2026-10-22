// Interpretacion LIMITADA. Nunca transforma texto en comandos del sistema.
export type OmegaApp = "notepad" | "calculator" | "explorer";
export function cleanText(text: string): string {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[¿?¡!.,;:]/g, " ").replace(/\s+/g, " ").trim();
}
export function parseWindowsIntent(raw: string): OmegaApp | null {
  const text = cleanText(raw);
  if (text.length > 180 || !/\b(abre|abrir|inicia|iniciar|ejecuta|ejecutar)\b/.test(text)) return null;
  const choices: Array<[OmegaApp, RegExp]> = [
    ["notepad", /\b(bloc de notas|notepad)\b/],
    ["calculator", /\b(calculadora|calculator|calc)\b/],
    ["explorer", /\b(explorador de archivos|explorador|explorer)\b/],
  ];
  const matched = choices.filter(([, pattern]) => pattern.test(text));
  return matched.length === 1 ? matched[0][0] : null;
}

// Ollama solo ayuda a clasificar. Su salida no es ejecutable y se valida por lista blanca.
export async function classifyWithLocalOllama(text: string): Promise<OmegaApp | null> {
  if (!/\b(abre|abrir|inicia|iniciar|ejecuta|ejecutar)\b/.test(cleanText(text))) return null;
  const base = (process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434").replace(/\/$/, "");
  // Evitar que el panel Windows envie instrucciones a una instancia Ollama remota.
  let url: URL;
  try { url = new URL(base); } catch { return null; }
  if (!(["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) && url.protocol === "http:")) return null;
  try {
    const response = await fetch(base + "/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.OLLAMA_MODEL || "llama3.1:8b",
        stream: false,
        think: false,
        format: "json",
        options: { temperature: 0, num_predict: 50 },
        messages: [
          { role: "system", content: 'Clasifica SOLO ordenes para abrir una de estas aplicaciones: notepad, calculator, explorer. Si no es inequívoco responde none. Devuelve exclusivamente JSON: {"app":"notepad|calculator|explorer|none"}. No ejecutes nada.' },
          { role: "user", content: text },
        ],
      }),
      signal: AbortSignal.timeout(12_000),
      cache: "no-store",
    });
    if (!response.ok) return null;
    const result = await response.json();
    const classification = JSON.parse(String(result?.message?.content || "{}"));
    const app = classification?.app;
    // Verificar que el nombre de la aplicacion aparece realmente en la orden:
    // el modelo no tiene permiso para inventar la intencion del usuario.
    if (app === "notepad" && /\b(bloc de notas|notepad)\b/.test(cleanText(text))) return app;
    if (app === "calculator" && /\b(calculadora|calculator|calc)\b/.test(cleanText(text))) return app;
    if (app === "explorer" && /\b(explorador de archivos|explorador|explorer)\b/.test(cleanText(text))) return app;
    return null;
  } catch { return null; }
}
