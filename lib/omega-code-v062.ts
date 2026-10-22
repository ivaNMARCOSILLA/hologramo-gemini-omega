/** v0.6.2: programación propuesta, sin ejecución. */
export const CODE_LANGUAGES = ['powershell', 'typescript', 'javascript', 'python', 'batch'] as const;
export type OmegaCodeLanguage = typeof CODE_LANGUAGES[number];
export function validCodeLanguage(language: unknown): language is OmegaCodeLanguage {
  return typeof language === 'string' && CODE_LANGUAGES.some(l => l === language);
}
export function localOllamaEndpoint(raw: string | undefined): string | null {
  let endpoint: URL;
  try { endpoint = new URL((raw || 'http://127.0.0.1:11434').replace(/\/$/, '')); }
  catch { return null; }
  if (endpoint.protocol !== 'http:' || !['127.0.0.1', 'localhost', '[::1]'].includes(endpoint.hostname)
      || endpoint.username || endpoint.password || endpoint.pathname !== '/' || endpoint.search || endpoint.hash) return null;
  return endpoint.origin;
}
export function stripCodeFence(raw: string): string {
  const text = raw.trim();
  const match = text.match(/```(?:[a-zA-Z0-9+#.-]+)?\s*\n([\s\S]*?)```/);
  return (match ? match[1] : text).trim();
}
