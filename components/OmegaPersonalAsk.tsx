'use client';

import { useCallback, useEffect, useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';

// OMEGA_PANTALLA_PERSONAL_V6: consulta sin permiso de pago individual.
// No expone el token del proveedor ni convierte las preguntas en acciones Windows.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
let sharedClient: ReturnType<typeof createBrowserClient> | null = null;
function authClient() {
  if (!supabaseUrl || !supabaseKey) return null;
  if (!sharedClient) sharedClient = createBrowserClient(supabaseUrl, supabaseKey);
  return sharedClient;
}
type Access = 'checking' | 'signin' | 'mfa' | 'unavailable' | 'ready';
type ApiState = { enabled?: boolean; message?: string; error?: string };
type ApiReply = { answer?: string; error?: string };

export default function OmegaPersonalAsk({ mode = 'main' }: { mode?: 'main' | 'sidebar' }) {
  const [access, setAccess] = useState<Access>('checking');
  const [detail, setDetail] = useState('');
  const [prompt, setPrompt] = useState('');
  const [answer, setAnswer] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const sidebar = mode === 'sidebar';

  const refreshAccess = useCallback(async () => {
    const sb = authClient();
    if (!sb) { setAccess('unavailable'); setDetail('La autenticación no está configurada en el navegador.'); return; }
    try {
      const { data, error } = await sb.auth.getSession();
      const token = error ? null : data.session?.access_token;
      if (!token) { setAccess('signin'); setDetail(''); return; }
      const response = await fetch('/api/omega-admin/ai', {
        method: 'GET', cache: 'no-store', headers: { Authorization: `Bearer ${token}` },
      });
      const result = await response.json() as ApiState;
      if (response.status === 401) { setAccess('signin'); setDetail('Vuelve a iniciar sesión.'); return; }
      if (response.status === 403) { setAccess('mfa'); setDetail('Acceso ADMIN y segundo factor MFA necesarios.'); return; }
      if (!response.ok || !result.enabled) {
        setAccess('unavailable'); setDetail(result.message || result.error || `Servicio no disponible (HTTP ${response.status}).`); return;
      }
      setAccess('ready'); setDetail('');
    } catch { setAccess('unavailable'); setDetail('No se pudo verificar la sesión del asistente.'); }
  }, []);

  useEffect(() => {
    const sb = authClient();
    if (!sb) { void refreshAccess(); return; }
    let mounted = true;
    void refreshAccess();
    const { data } = sb.auth.onAuthStateChange(() => {
      // Deja que Supabase termine su transición de sesión antes de consultar.
      setTimeout(() => { if (mounted) void refreshAccess(); }, 0);
    });
    return () => { mounted = false; data.subscription.unsubscribe(); };
  }, [refreshAccess]);

  async function send() {
    const text = prompt.trim();
    if (busy || access !== 'ready' || text.length < 2 || text.length > 2500) return;
    setBusy(true); setStatus('OMEGA está respondiendo…'); setAnswer('');
    try {
      const sb = authClient();
      if (!sb) throw new Error('Supabase no está configurado.');
      const { data, error } = await sb.auth.getSession();
      const token = error ? null : data.session?.access_token;
      if (!token) { setAccess('signin'); throw new Error('Tu sesión ha caducado. Accede de nuevo.'); }
      const response = await fetch('/api/omega-admin/ai', {
        method: 'POST', cache: 'no-store',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ prompt: text }),
      });
      const result = await response.json() as ApiReply;
      if (response.status === 401) setAccess('signin');
      if (response.status === 403) setAccess('mfa');
      if (!response.ok || !result.answer) throw new Error(result.error || `Consulta no disponible (HTTP ${response.status}).`);
      setAnswer(result.answer); setStatus('Respuesta de OMEGA recibida.');
    } catch (error) { setStatus(error instanceof Error ? error.message : 'No se pudo consultar OMEGA.'); }
    finally { setBusy(false); }
  }

  return <div data-omega-personal-ui="v6" style={{ maxWidth: '100%', color: 'inherit' }}>
    {!sidebar && <p className="ou-small">Sin suscripciones ni créditos internos por pregunta. Acceso privado ADMIN + MFA. El proveedor OpenRouter puede seguir facturando los tokens reales.</p>}
    {access === 'checking' && <p role="status" className="ou-small">Comprobando acceso a OMEGA…</p>}
    {(access === 'signin' || access === 'mfa') && <div>
      <p role="status" className="ou-small">{access === 'signin' ? 'Inicia sesión para preguntar a OMEGA.' : detail}</p>
      <a href="/omega-personal" className="ou-secondary" style={{ display: 'inline-block', padding: '10px 14px', borderRadius: 8, textDecoration: 'none' }}>
        {access === 'signin' ? 'Iniciar sesión' : 'Verificar segundo factor'}
      </a>
      <button type="button" className="ou-secondary" onClick={() => void refreshAccess()} style={{ marginLeft: 8 }}>Revisar acceso</button>
    </div>}
    {access === 'unavailable' && <p role="status" className="ou-small">{detail}</p>}
    {access === 'ready' && <form onSubmit={event => { event.preventDefault(); void send(); }}>
      <label htmlFor={`omega-pregunta-${mode}`} className="ou-field-label">{sidebar ? 'ESCRIBE A OMEGA' : '¿QUÉ QUIERES PREGUNTAR A OMEGA?'}</label>
      <textarea id={`omega-pregunta-${mode}`} rows={sidebar ? 3 : 5} maxLength={2500} value={prompt}
        onChange={event => setPrompt(event.target.value)} placeholder="Escribe tu pregunta…" />
      <div className="ou-actions" style={{ marginTop: 10 }}>
        <button type="submit" className="ou-primary" disabled={busy || prompt.trim().length < 2}>
          {busy ? 'Consultando…' : sidebar ? 'Enviar a OMEGA' : 'Preguntar a OMEGA'}
        </button>
        {!sidebar && <button type="button" className="ou-secondary" disabled={busy || (!prompt && !answer)}
          onClick={() => { setPrompt(''); setAnswer(''); setStatus(''); }}>Limpiar</button>}
      </div>
    </form>}
    {status && <p role="status" aria-live="polite" className="ou-small">{status}</p>}
    {answer && <div className="ou-market-reply" style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', marginTop: 12 }}>{answer}</div>}
  </div>;
}
