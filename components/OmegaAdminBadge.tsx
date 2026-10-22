'use client';

import { useEffect, useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { ShieldCheck } from 'lucide-react';

type AdminView = { role: 'admin'; mfa: boolean; canManage: boolean } | null;

export default function OmegaAdminBadge() {
  const [state, setState] = useState<AdminView>(null);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  useEffect(() => {
    if (!url || !key) return;
    const supabase = createBrowserClient(url, key);
    let active = true;
    async function refresh() {
      try {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        if (!token) { if (active) setState(null); return; }
        const res = await fetch('/api/omega-admin/status', {
          headers: { Authorization: `Bearer ${token}` }, cache: 'no-store',
        });
        const json: { role?: string; mfa?: boolean; canManage?: boolean } = await res.json();
        if (active) setState(res.ok && json.role === 'admin' ? { role: 'admin', mfa: !!json.mfa, canManage: !!json.canManage } : null);
      } catch { if (active) setState(null); }
    }
    void refresh();
    const { data } = supabase.auth.onAuthStateChange(() => {
      // Postpone work until Supabase completes its auth update.
      setTimeout(() => { if (active) void refresh(); }, 0);
    });
    return () => { active = false; data.subscription.unsubscribe(); };
  }, [url, key]);

  if (!state) return null;
  return <div role="status" aria-live="polite" style={{
    display:'flex', alignItems:'center', gap:8, padding:'12px 14px',
    border:'1px solid currentColor', borderRadius:12, margin:'12px 0'
  }}>
    <ShieldCheck size={20} aria-hidden="true"/>
    <div><strong>Administrador OMEGA</strong>
      <p style={{margin:'4px 0 0',fontSize:13}}>{state.canManage
        ? 'Identidad y segundo factor verificados. Acceso administrativo habilitado.'
        : 'Correo verificado y rol confirmado. Activa el segundo factor en esta pantalla para tareas administrativas.'}</p>
    </div>
  </div>;
}
