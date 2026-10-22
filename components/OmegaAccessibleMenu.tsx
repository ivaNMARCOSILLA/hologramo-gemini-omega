"use client";
import { useCallback, useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { applyPrefs, defaultPrefs, feedback, loadPrefs, savePrefs, type A11yPrefs } from "../lib/omega-a11y-feedback";

const ITEMS: { key: keyof A11yPrefs; label: string; desc: string }[] = [
  { key: "subtitulos", label: "Subtítulos visibles", desc: "Muestra en pantalla todo lo que dice OMEGA (discapacidad auditiva)" },
  { key: "voz", label: "Avisos por voz", desc: "Lee en voz alta los avisos de accesibilidad (discapacidad visual)" },
  { key: "vibracion", label: "Vibración", desc: "Confirma acciones vibrando (táctil; móviles compatibles)" },
  { key: "altoContraste", label: "Alto contraste", desc: "Texto blanco sobre negro y bordes amarillos" },
  { key: "textoGrande", label: "Texto grande", desc: "Aumenta el texto y el tamaño de los botones" },
  { key: "movimientoReducido", label: "Reducir movimiento", desc: "Elimina animaciones y transiciones" },
  { key: "futurista", label: "Interfaz futurista", desc: "Efectos holográficos; no cambia textos ni posiciones" },
];

export default function OmegaAccessibleMenu() {
  const [open, setOpen] = useState(false);
  const [prefs, setPrefs] = useState<A11yPrefs>(defaultPrefs);
  const btnRef = useRef<HTMLButtonElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    const p = loadPrefs();
    applyPrefs(p);
    const t = window.setTimeout(() => setPrefs(p), 0);
    return () => window.clearTimeout(t);
  }, []);

  const close = useCallback((focusButton = true) => {
    setOpen(false);
    if (focusButton) btnRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => itemRefs.current[0]?.focus(), 0);
    const onDown = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) close(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [open, close]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey && e.shiftKey && (e.key === "A" || e.key === "a")) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const toggle = (key: keyof A11yPrefs) => {
    const next: A11yPrefs = { ...prefs, [key]: !prefs[key] };
    setPrefs(next);
    savePrefs(next);
    const item = ITEMS.find((i) => i.key === key);
    feedback(`${item?.label ?? key}: ${next[key] ? "activado" : "desactivado"}`, "ok");
  };

  const onMenuKey = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    const els = itemRefs.current.filter((x): x is HTMLButtonElement => x !== null);
    const i = els.indexOf(document.activeElement as HTMLButtonElement);
    switch (e.key) {
      case "ArrowDown": e.preventDefault(); els[(i + 1) % els.length]?.focus(); break;
      case "ArrowUp": e.preventDefault(); els[(i - 1 + els.length) % els.length]?.focus(); break;
      case "Home": e.preventDefault(); els[0]?.focus(); break;
      case "End": e.preventDefault(); els[els.length - 1]?.focus(); break;
      case "Escape": e.preventDefault(); close(); break;
      case "Tab": close(false); break;
    }
  };

  return (
    <div ref={wrapRef} className="omega-a11y-menu">
      <button
        ref={btnRef}
        type="button"
        className="omega-a11y-btn"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls="omega-a11y-list"
        aria-keyshortcuts="Alt+Shift+A"
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") { e.preventDefault(); setOpen(true); }
        }}
      >
        <span aria-hidden="true">{"\u267F"}</span> Accesibilidad
      </button>
      {open && (
        <div id="omega-a11y-list" role="menu" aria-label="Opciones de accesibilidad" className="omega-a11y-list" onKeyDown={onMenuKey}>
          {ITEMS.map((it, idx) => (
            <button
              key={it.key}
              ref={(el) => { itemRefs.current[idx] = el; }}
              type="button"
              role="menuitemcheckbox"
              aria-checked={prefs[it.key]}
              tabIndex={-1}
              className="omega-a11y-item"
              onClick={() => toggle(it.key)}
            >
              <span className="omega-a11y-check" aria-hidden="true">{prefs[it.key] ? "\u2713" : ""}</span>
              <span><strong>{it.label}</strong><small>{it.desc}</small></span>
            </button>
          ))}
          <p className="omega-a11y-hint">Alt + Mayús + A abre/cierra · Flechas para moverse · Esc para cerrar</p>
        </div>
      )}
    </div>
  );
}