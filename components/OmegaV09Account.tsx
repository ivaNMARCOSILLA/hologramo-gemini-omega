'use client';

import { useEffect, useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { KeyRound, LogOut, ShieldCheck } from 'lucide-react';
import OmegaAdminBadge from '@/components/OmegaAdminBadge';
import OmegaAdminPilot from '@/components/OmegaAdminPilot';

// Cuenta personal: sin precios, registro público, checkout ni enlace de contratación.
// Conserva Supabase Auth, segundo factor y los módulos administrativos existentes.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
let cached: ReturnType<typeof createBrowserClient> | null = null;
function client() {
  if (!url || !key) return null;
  if (!cached) cached = createBrowserClient(url, key);
  return cached;
}

type Account = { id: string; email: string | null };
export default function OmegaV09Account() {
  const [account, setAccount] = useState<Account | null>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mfaLevel, setMfaLevel] = useState('aal1');
  const [factorId, setFactorId] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [totpSecret, setTotpSecret] = useState('');

  useEffect(() => {
    const sb = client();
    if (!sb) { setReady(true); return; }
    let active = true;
    const refresh = async () => {
      const { data: userData } = await sb.auth.getUser();
      if (!active) return;
      const user = userData.user;
      setAccount(user ? { id: user.id, email: user.email || null } : null);
      const { data: aal } = await sb.auth.mfa.getAuthenticatorAssuranceLevel();
      if (active) setMfaLevel(aal?.currentLevel || 'aal1');
      setReady(true);
    };
    void refresh().catch(() => { if (active) setReady(true); });
    const { data: authListener } = sb.auth.onAuthStateChange(() => {
      // No hay actualizaciones de pago. La cuenta sigue requiriendo autenticación real.
      setTimeout(() => { if (active) void refresh().catch(() => undefined); }, 0);
    });
    return () => { active = false; authListener.subscription.unsubscribe(); };
  }, []);

  async function login() {
    const sb = client();
    if (!sb) return;
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setMessage('Introduce un correo válido y tu contraseña.');
      return;
    }
    setBusy(true);
    try {
      const { error } = await sb.auth.signInWithPassword({ email, password });
      if (error) throw error;
      setPassword('');
      setMessage('Sesión iniciada. Completa el segundo factor para acceder a funciones protegidas.');
    } catch (e) { setMessage(e instanceof Error ? e.message : 'No se pudo iniciar sesión.'); }
    finally { setBusy(false); }
  }

  async function logout() {
    const sb = client(); if (!sb) return;
    await sb.auth.signOut();
    setAccount(null); setMfaLevel('aal1'); setTotpSecret(''); setMfaCode('');
    setMessage('Sesión cerrada.');
  }

  async function resetPassword() {
    const sb = client(); if (!sb || !/^\S+@\S+\.\S+$/.test(email)) {
      setMessage('Introduce un correo válido para recuperar el acceso.'); return;
    }
    setBusy(true);
    try {
      const { error } = await sb.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/callback?next=/cuenta`,
      });
      if (error) throw error;
      setMessage('Si el correo corresponde a una cuenta existente, recibirás instrucciones.');
    } catch (e) { setMessage(e instanceof Error ? e.message : 'No se pudo solicitar recuperación.'); }
    finally { setBusy(false); }
  }

  async function enrollMfa() {
    const sb = client(); if (!sb) return;
    setBusy(true);
    try {
      const { data: factors, error: listError } = await sb.auth.mfa.listFactors();
      if (listError) throw listError;
      const verified = factors.totp.find((f: { status: string; id: string }) => f.status === 'verified');
      if (verified) { setFactorId(verified.id); setMessage('Introduce el código de tu aplicación de autenticación.'); return; }
      const { data, error } = await sb.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'OMEGA personal' });
      if (error || !data?.totp) throw error || new Error('No se pudo configurar el segundo factor.');
      setFactorId(data.id); setTotpSecret(data.totp.secret);
      setMessage('Añade la clave a tu aplicación TOTP y verifica un código.');
    } catch (e) { setMessage(e instanceof Error ? e.message : 'No se pudo preparar MFA.'); }
    finally { setBusy(false); }
  }

  async function verifyMfa() {
    const sb = client(); if (!sb) return;
    if (!/^\d{6}$/.test(mfaCode)) { setMessage('Introduce seis dígitos.'); return; }
    setBusy(true);
    try {
      let id = factorId;
      if (!id) {
        const { data, error } = await sb.auth.mfa.listFactors();
        if (error) throw error;
        id = data.totp.find((f: { status: string; id: string }) => f.status === 'verified')?.id || '';
      }
      if (!id) throw new Error('Configura primero el segundo factor.');
      const { data, error } = await sb.auth.mfa.challenge({ factorId: id });
      if (error || !data) throw error || new Error('No se pudo crear el desafío MFA.');
      const check = await sb.auth.mfa.verify({ factorId: id, challengeId: data.id, code: mfaCode });
      if (check.error) throw check.error;
      setMfaLevel('aal2'); setMfaCode(''); setTotpSecret('');
      setMessage('Segundo factor verificado.');
    } catch (e) { setMessage(e instanceof Error ? e.message : 'Código incorrecto.'); }
    finally { setBusy(false); }
  }

  return <section className="ou-v09-account ou-section" aria-label="Cuenta personal OMEGA">
    <OmegaAdminBadge /><OmegaAdminPilot />
    <div className="ou-v09-account-title">
      <ShieldCheck size={25} />
      <div><h2>OMEGA · uso personal</h2><p>Acceso privado para una cuenta existente. Sin planes, precios ni contratación de suscripciones.</p></div>
    </div>
    {!url || !key ? <p role="status">Configura Supabase en el servidor. No se desactiva la autenticación.</p>
    : !ready ? <p>Comprobando sesión…</p>
    : account ? <div className="ou-v09-account-status">
        <strong>Sesión: {account.email || 'Cuenta OMEGA'}</strong>
        <p>Protección de cuenta: {mfaLevel === 'aal2' ? 'segundo factor confirmado' : 'segundo factor pendiente'}</p>
        <div className="ou-v09-account-actions">
          <button type="button" disabled={busy} onClick={() => void logout()}><LogOut size={15} /> Salir</button>
          {mfaLevel !== 'aal2' && <button type="button" disabled={busy} onClick={() => void enrollMfa()}>Configurar/verificar segundo factor</button>}
        </div>
        {mfaLevel !== 'aal2' && <div className="ou-v09-mfa">
          {totpSecret && <p>Clave TOTP temporal: <code>{totpSecret}</code>. No la compartas.</p>}
          <label>Código TOTP <input inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={mfaCode} onChange={e => setMfaCode(e.target.value.replace(/\D/g, '').slice(0,6))} /></label>
          <button type="button" disabled={busy || mfaCode.length !== 6} onClick={() => void verifyMfa()}>Verificar código</button>
        </div>}
      </div>
    : <form className="ou-v09-signin" onSubmit={e => { e.preventDefault(); void login(); }}>
        <label htmlFor="omega-personal-email">Correo electrónico
          <input id="omega-personal-email" type="email" autoComplete="username" required value={email} onChange={e => setEmail(e.target.value)} />
        </label>
        <label htmlFor="omega-personal-password">Frase de acceso
          <input id="omega-personal-password" type="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} />
        </label>
        <div className="ou-v09-account-actions">
          <button type="submit" disabled={busy}><KeyRound size={16} /> Entrar</button>
          <button type="button" disabled={busy} onClick={() => void resetPassword()}>Recuperar acceso</button>
        </div>
      </form>}
    {message && <p className="ou-v09-account-message" role="status">{message}</p>}
    <p>OMEGA es ahora una herramienta personal. Las funciones administrativas siguen protegidas por sus verificaciones existentes.</p>
  </section>;
}
