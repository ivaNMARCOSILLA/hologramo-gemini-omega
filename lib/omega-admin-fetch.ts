import { createBrowserClient } from "@supabase/ssr";

/**
 * Llamadas a /api/omega-admin/* con el token de la sesión ACTUAL.
 * createBrowserClient es singleton en el navegador: devuelve la misma instancia
 * (y la misma sesión) que ya usa el proyecto. No se leen cookies ni localStorage a mano.
 * La autorización real la hace omegaAdminGate en el servidor.
 */
function browserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key || typeof window === "undefined") return null;
  return createBrowserClient(url, key);
}

export async function adminFetch(path: string, init: RequestInit = {}): Promise<Response | null> {
  // El token solo se envía a rutas admin del mismo origen.
  if (!path.startsWith("/api/omega-admin/")) throw new Error("Ruta no permitida para adminFetch");
  const sb = browserClient();
  if (!sb) return null;
  const { data } = await sb.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return null;
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  return fetch(path, { ...init, headers, credentials: "same-origin", cache: "no-store" });
}

/** Avisa cuando cambia la sesión (login, logout, refresco). Diferido para no bloquear Supabase. */
export function onAuthChange(cb: () => void): () => void {
  const sb = browserClient();
  if (!sb) return () => {};
  const { data } = sb.auth.onAuthStateChange(() => {
    window.setTimeout(cb, 0);
  });
  return () => data.subscription.unsubscribe();
}