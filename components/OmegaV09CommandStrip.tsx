'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Eye, Keyboard, Mic, MousePointer2, ShieldCheck, ShieldOff, Volume2 } from 'lucide-react';
import { OMEGA_VOICE_EXAMPLES } from '@/lib/omega-command-v11';

type Props = {
  onCommand: (text: string) => void;
  onTalk: () => void;
  speaking: boolean;
  listening: boolean;
  busy: boolean;
  safeAuto: boolean;
  safeAutoBusy: boolean;
  localAvailable: boolean;
  onSafeAuto: (enabled: boolean) => void;
};
type Theme = 'noche' | 'claro' | 'contraste' | 'ambar' | 'azul' | 'daltonismo';
const THEMES: { key: Theme; title: string }[] = [
  { key: 'noche', title: 'Noche' }, { key: 'claro', title: 'Claro' }, { key: 'contraste', title: 'Alto contraste' },
  { key: 'ambar', title: 'Ámbar' }, { key: 'azul', title: 'Azul suave' }, { key: 'daltonismo', title: 'Distinción por formas' },
];
export default function OmegaV09CommandStrip({ onCommand, onTalk, speaking, listening, busy, safeAuto, safeAutoBusy, localAvailable, onSafeAuto }: Props) {
  const [text, setText] = useState('');
  const [theme, setTheme] = useState<Theme>('noche');
  const [large, setLarge] = useState(false);
  const [lowMotion, setLowMotion] = useState(false);
  const [wakeword, setWakeword] = useState(false);
  const [open, setOpen] = useState(false);
  const [showCommands, setShowCommands] = useState(false);
  const [ready, setReady] = useState(false);
  const stripRef = useRef<HTMLDivElement>(null);
  const orbRef = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    try {
      const t = localStorage.getItem('omega:v09:theme');
      if (THEMES.some(x => x.key === t)) setTheme(t as Theme);
      setLarge(localStorage.getItem('omega:v09:large') === 'true');
      setLowMotion(localStorage.getItem('omega:v09:reduced-motion') === 'true');
      setWakeword(localStorage.getItem('omega:v09:wakeword') === 'true');
    } catch { /* storage opt-out */ }
    setReady(true);
  }, []);
  useEffect(() => {
    if (!ready) return;
    const root = stripRef.current?.closest('.ou-wrap');
    if (!root) return;
    root.setAttribute('data-omega-theme', theme);
    root.setAttribute('data-omega-large', String(large));
    root.setAttribute('data-omega-reduced', String(lowMotion));
    try {
      localStorage.setItem('omega:v09:theme', theme);
      localStorage.setItem('omega:v09:large', String(large));
      localStorage.setItem('omega:v09:reduced-motion', String(lowMotion));
      localStorage.setItem('omega:v09:wakeword', String(wakeword));
    } catch { /* storage opt-out */ }
    return () => {};
  }, [theme, large, lowMotion, wakeword, ready]);
  useEffect(() => {
    const openHelp = () => setShowCommands(true);
    window.addEventListener('omega:voice-show-help',openHelp);
    return () => window.removeEventListener('omega:voice-show-help',openHelp);
  }, []);
  // OMEGA_VOICE_TOTAL_V11: temas y accesibilidad controlables desde voz o teclado.
  useEffect(() => {
    const onVoiceAppearance = (event: Event) => {
      const detail = (event as CustomEvent<{kind:string;theme?:Theme;feature?:string;value?:boolean}>).detail;
      if (!detail) return;
      if (detail.kind === 'theme' && THEMES.some(t => t.key === detail.theme)) setTheme(detail.theme as Theme);
      if (detail.kind === 'accessibility' && typeof detail.value === 'boolean') {
        if (detail.feature === 'large') setLarge(detail.value);
        if (detail.feature === 'reduced-motion') setLowMotion(detail.value);
        if (detail.feature === 'wakeword') setWakeword(detail.value);
      }
      setOpen(true);
    };
    window.addEventListener('omega:accessibility', onVoiceAppearance);
    return () => window.removeEventListener('omega:accessibility', onVoiceAppearance);
  }, []);
  // Decorative mini-Omega follows pointer proximity, NOT controlling the operating system cursor.
  useEffect(() => {
    const parent = stripRef.current?.closest('.ou-wrap');
    const orb = orbRef.current;
    if (!parent || !orb) return;
    if (lowMotion || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let pending = 0;
    const onPointer = (event: Event) => {
      const e = event as PointerEvent;
      if (e.pointerType === 'touch') return;
      if (pending) return;
      pending = requestAnimationFrame(() => {
        const x = Math.max(10, e.clientX - 14);
        const y = Math.max(10, e.clientY - 14);
        orb.style.transform = `translate3d(${x}px,${y}px,0)`;
        orb.style.opacity = '0.85';
        pending = 0;
      });
    };
    const hide = () => { orb.style.opacity = '0'; };
    parent.addEventListener('pointermove', onPointer, { passive: true });
    parent.addEventListener('pointerleave', hide);
    return () => { parent.removeEventListener('pointermove', onPointer); parent.removeEventListener('pointerleave', hide); cancelAnimationFrame(pending); };
  }, [lowMotion]);
  // Las órdenes habladas hacen que el mini-Omega señale su destino visual.
  useEffect(() => {
    const orb = orbRef.current;
    if (!orb || lowMotion) return;
    let raf1 = 0, raf2 = 0;
    const focus = (event: Event) => {
      const name = event.type;
      const instruction = name === 'omega:unified-command' ? (event as CustomEvent<{instruction?:{kind?:string}}>).detail?.instruction : undefined;
      const place = () => {
        const destination = instruction?.kind?.startsWith('code_') ? '#ou-code-instruction'
          : instruction?.kind?.startsWith('editor_') ? '#ou-editor'
          : instruction?.kind === 'theme' || instruction?.kind === 'accessibility' ? '.ou-v09-control'
          : '.ou-nav-button[aria-current="page"]';
        const target = name === 'omega:voice-code'
          ? document.querySelector<HTMLElement>('#ou-code-instruction')
          : name === 'omega:voice-order'
            ? document.querySelector<HTMLElement>('#ou-command')
            : document.querySelector<HTMLElement>(destination);
        if (!target) return;
        const r = target.getBoundingClientRect();
        orb.style.transform = `translate3d(${Math.max(10, r.left - 18)}px,${Math.max(10, r.top + Math.min(14,r.height/2))}px,0)`;
        orb.style.opacity = '0.95';
      };
      raf1 = requestAnimationFrame(() => { raf2 = requestAnimationFrame(place); });
    };
    for (const name of ['omega:av-command','omega:voice-code','omega:voice-order','omega:unified-command']) window.addEventListener(name, focus);
    return () => {
      for (const name of ['omega:av-command','omega:voice-code','omega:voice-order','omega:unified-command']) window.removeEventListener(name, focus);
      cancelAnimationFrame(raf1); cancelAnimationFrame(raf2);
    };
  }, [lowMotion]);
  function submit(e: FormEvent) {
    e.preventDefault();
    const msg = text.trim();
    if (!msg) return;
    onCommand(msg);
    setText('');
  }
  return <div className="ou-v09-control" ref={stripRef}>
    <span ref={orbRef} className={'ou-v09-pointer-orb ' + (listening ? 'ou-v09-listen' : speaking ? 'ou-v09-speak' : busy ? 'ou-v09-think' : '')} aria-hidden="true">Ω</span>
    <form className="ou-v09-textform" onSubmit={submit}>
      <Keyboard size={18} aria-hidden="true"/>
      <label className="ou-v09-sr" htmlFor="ou-v09-entry">Escribir una orden o pregunta para OMEGA</label>
      <input id="ou-v09-entry" value={text} onChange={e => setText(e.target.value)} maxLength={1500} placeholder="Escribe: abre calculadora · programa… · guarda idea…"/>
      <button type="submit" disabled={!text.trim()} aria-label="Enviar orden escrita a OMEGA">Enviar ↵</button>
    </form>
    <div className="ou-v09-controlactions">
      <button type="button" className="ou-v09-action" onClick={onTalk} aria-label="Activar o desactivar voz"><Mic size={16}/> Voz</button>
      <button type="button" className="ou-v09-action" onClick={() => setShowCommands(v => !v)} aria-expanded={showCommands} aria-controls="ou-v11-comandos">Comandos</button>
      <button type="button" className="ou-v09-action" onClick={() => setOpen(v => !v)} aria-expanded={open} aria-controls="ou-v09-access"><Eye size={16}/> Accesibilidad</button>
    </div>
    {showCommands && <section id="ou-v11-comandos" className="ou-v11-guide" aria-label="Comandos OMEGA por voz o teclado"><strong>Órdenes reconocidas por OMEGA</strong><p>Las mismas frases funcionan habladas o escritas. Las consultas de IA y el código generado requieren autorización para cada gasto; Windows abre solo aplicaciones permitidas.</p><ul>{OMEGA_VOICE_EXAMPLES.map(example => <li key={example}>{example}</li>)}</ul></section>}
    {open && <div id="ou-v09-access" className="ou-v09-access" role="group" aria-label="Opciones de accesibilidad de OMEGA">
      <label>Paleta visual<select aria-label="Paleta visual" value={theme} onChange={e => setTheme(e.target.value as Theme)}>{THEMES.map(t => <option key={t.key} value={t.key}>{t.title}</option>)}</select></label>
      <label><input type="checkbox" checked={large} onChange={e => setLarge(e.target.checked)}/> Texto grande</label>
      <label><input type="checkbox" checked={lowMotion} onChange={e => setLowMotion(e.target.checked)}/> Reducir animaciones</label>
      <label><input type="checkbox" checked={wakeword} onChange={e => setWakeword(e.target.checked)}/> Exigir «OMEGA» antes de cada orden hablada (no identifica personas)</label>
      <div className="ou-v09-safe"><div><strong>Aplicaciones seguras sin clic repetido</strong><small>Solo Calculadora, Bloc de notas y Explorador, desde localhost. Se desactiva al reiniciar el agente. UAC y pagos nunca se aceptan automáticamente.</small></div><button type="button" disabled={!localAvailable || safeAutoBusy} className="ou-v09-action" onClick={() => onSafeAuto(!safeAuto)}>{safeAuto ? <ShieldCheck size={16}/> : <ShieldOff size={16}/>} {safeAuto ? 'Desactivar' : 'Activar'}</button></div>
      <p className="ou-v09-note"><MousePointer2 size={14}/> El mini-holograma acompaña el puntero visualmente, pero no mueve ni controla el ratón de Windows. <Volume2 size={14}/> La voz reconoce palabras, no verifica una identidad biométrica.</p>
    </div>}
  </div>;
}
