/** OMEGA v0.6: catalogo local de modelos; precios orientativos, no facturacion oficial. */
export const OMEGA_MODELS = [
  { id: 'anthropic/claude-sonnet-4.6', name: 'Claude Sonnet 4.6 · automatización y código', input: 3, output: 15 },
  { id: 'google/gemini-3.1-pro-preview', name: 'Gemini 3.1 Pro · análisis y programación', input: 2, output: 12 },
  { id: 'openai/gpt-5.5', name: 'GPT-5.5 · tareas de ingeniería complejas', input: 5, output: 30 },
] as const;
export type OmegaModelId = (typeof OMEGA_MODELS)[number]['id'];
export function marketModel(id: string) { return OMEGA_MODELS.find(m => m.id === id); }
export function estimatedDollars(id: string, inputTokens: number, outputTokens: number): number {
  const m = marketModel(id);
  if (!m || !Number.isFinite(inputTokens) || !Number.isFinite(outputTokens) || inputTokens < 0 || outputTokens < 0) throw new Error('Modelo o tokens invalidos');
  return (inputTokens * m.input + outputTokens * m.output) / 1_000_000;
}
export function monthKey(now: Date = new Date()): string { return now.toISOString().slice(0, 7); }
export function parseMonthlyLimit(raw: string | undefined): number {
  const value = Number(raw || '5');
  if (!Number.isFinite(value) || value <= 0 || value > 1000) return 5;
  return value;
}
/** Sólo acepta peticiones realmente originadas en la web local. */
export function permittedMarketRequest(request: Request): boolean {
  if (process.env.NODE_ENV !== 'development') return false;
  let url: URL;
  try { url = new URL(request.url); } catch { return false; }
  if (url.protocol !== 'http:' || !['localhost','127.0.0.1'].includes(url.hostname)) return false;
  const host = request.headers.get('host') || '';
  if (!/^(localhost|127\.0\.0\.1)(:\d+)?$/i.test(host)) return false;
  const fetchSite = request.headers.get('sec-fetch-site');
  if (fetchSite && fetchSite !== 'same-origin') return false;
  if (request.method === 'POST') {
    if (request.headers.get('origin') !== 'http://' + host) return false;
    if (!(request.headers.get('content-type') || '').startsWith('application/json')) return false;
  }
  return true;
}
