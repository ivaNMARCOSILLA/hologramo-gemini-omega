'use client';

import { useCallback, useEffect, useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';

const sbUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const sbKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

type State = { enabled?: boolean; message?: string; error?: string };
type Reply = { answer?: string; error?: string; note?: string };

export default function OmegaAdminPilot() {
  const [visible, setVisible] = useState(false);
  const [state, setState] = useState<State | null>(null);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);

  const getToken = useCallback(async () => {
    if (!sbUrl || !sbKey) return null;
    const sb = createBrowserClient(sbUrl, sbKey);
    const { data, error } = await sb.auth.getSession();
    return error ? null : data.session?.access_token || null;
  }, []);

  const refresh = useCallback(async () => {
    const token = await getToken();
    if (!token) { setVisible(false); setState(null); return; }
    try {
      const response = await fetch('/api/omega-admin/ai', {
        headers: { Authorization: `Bearer ${token}` }, cache: 'no-store',
      });
      if (response.status === 401 || response.status === 403) { setVisible(false); return; }
      const payload = await response.json() as State;
      setState(payload); setVisible(response.ok || response.status === 503);
    } catch { setVisible(true); setState({ enabled: false, message: 'Sin conexion con OMEGA IA.' }); }
  }, [getToken]);

  useEffect(() => {
    if (!sbUrl || !sbKey) return;
    const sb = createBrowserClient(sbUrl, sbKey);
    let active = true;
    void refresh();
    const { data } = sb.auth.onAuthStateChange(() => {
      setTimeout(() => { if (active) void refresh(); }, 0);
    });
    return () => { active = false; data.subscription.unsubscribe(); };
  }, [refresh]);

  async function submit() {
    const text = question.trim();
    if (busy || !state?.enabled || text.length < 2 || text.length > 2500) return;
    setBusy(true); setStatus('Consultando OMEGA...'); setAnswer('');
    try {
      const token = await getToken();
      if (!token) throw new Error('Sesion caducada. Inicia sesion y verifica MFA.');
      const response = await fetch('/api/omega-admin/ai', {
        method: 'POST', cache: 'no-store',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ prompt: text }),
      });
      const result = await response.json() as Reply;
      if (!response.ok || !result.answer) throw new Error(result.error || `HTTP ${response.status}`);
      setAnswer(result.answer); setStatus('Respuesta recibida.');
    } catch (e) { setStatus(e instanceof Error ? e.message : 'No se pudo consultar OMEGA.'); }
    finally { setBusy(false); }
  }

  if (!visible) return null;
  return <section aria-label="OMEGA IA personal" style={{ padding: 20, margin: '18px 0',
    border: '1px solid #4589a0', background: '#0b2432', color: '#effcff', borderRadius: 14 }}>
    <h3 style={{ margin: '0 0 8px' }}>Ω OMEGA IA · uso personal</h3>
    <p style={{ lineHeight: 1.55 }}>Sin planes, monedas ni descuento de creditos por consulta. Solo cuenta ADMIN con MFA.
      La IA de OpenRouter puede generar costes reales por tokens. No se ejecutan acciones de Windows desde este chat.</p>
    {state?.enabled ? <>
      <label htmlFor="omega-personal-pregunta">Pregunta a OMEGA</label>
      <textarea id="omega-personal-pregunta" rows={4} maxLength={2500} value={question}
        onChange={e => setQuestion(e.target.value)} style={{ width: '100%', padding: 12, borderRadius: 8,
          border: '1px solid #6ecce2', background: '#071823', color: '#fff', marginTop: 8 }} />
      <div style={{ marginTop: 10 }}><button type="button" onClick={() => void submit()}
        disabled={busy || question.trim().length < 2 || question.length > 2500}
        style={{ padding: '11px 18px', borderRadius: 8, background: '#6ce2e1', color: '#102a35', fontWeight: 700 }}>
        {busy ? 'Consultando...' : 'Preguntar a OMEGA'}
      </button></div>
    </> : <p role="status">{state?.message || state?.error || 'IA personal no configurada.'}</p>}
    {status && <p aria-live="polite" role="status">{status}</p>}
    {answer && <div style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', paddingTop: 14,
      marginTop: 12, borderTop: '1px solid #4589a0' }}>{answer}</div>}
  </section>;
}
