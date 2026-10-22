import OmegaV09Account from '@/components/OmegaV09Account';
import OmegaWindowsRemote from '@/components/OmegaWindowsRemote';

// Panel personal. El agente Windows es local y se comunica solo a traves del puente
// existente que exige rol ADMIN, MFA y consentimiento en Windows.
export default function OmegaPersonalPage() {
  return <main style={{ minHeight: '100vh', padding: '24px', background: '#061625', color: '#e4faff' }}>
    <div style={{ maxWidth: 860, margin: '0 auto' }}>
      <header style={{ marginBottom: 22 }}>
        <h1 style={{ fontSize: '2rem', marginBottom: 8 }}>Ω HOLOGRAMO · PERSONAL</h1>
        <p>Tu cuenta y tu laboratorio privado de IA, sin suscripciones ni creditos internos.</p>
      </header>
      <OmegaV09Account />
      <OmegaWindowsRemote />
      <p style={{ marginTop: 20, fontSize: 14, opacity: .8 }}>
        OMEGA Operador 6 con Whisper, PDF, Word, Excel y PowerShell sigue ejecutandose
        en tu ordenador Windows. La web no ejecuta Python ni comandos arbitrarios.
      </p>
    </div>
  </main>;
}
