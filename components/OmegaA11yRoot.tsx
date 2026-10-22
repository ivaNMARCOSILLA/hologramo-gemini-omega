"use client";
import { useEffect, useState, type MouseEvent as ReactMouseEvent } from "react";
import OmegaAccessibleMenu from "./OmegaAccessibleMenu";
import OmegaSupervisor from "./OmegaSupervisor";
import { loadPrefs, ownUtterances, vibrate, type FeedbackKind } from "../lib/omega-a11y-feedback";

type Caption = { id: number; msg: string; kind: FeedbackKind; visible: boolean };

export default function OmegaA11yRoot() {
  const [captions, setCaptions] = useState<Caption[]>([]);

  useEffect(() => {
    let n = 0;
    const timers = new Set<number>();
    const onCap = (e: Event) => {
      const d = (e as CustomEvent<{ msg: string; kind: FeedbackKind; visible: boolean }>).detail;
      if (!d?.msg) return;
      const id = ++n;
      setCaptions((c) => [...c.slice(-2), { id, msg: d.msg.slice(0, 400), kind: d.kind, visible: d.visible }]);
      const t = window.setTimeout(() => {
        setCaptions((c) => c.filter((x) => x.id !== id));
        timers.delete(t);
      }, Math.min(12000, 3000 + d.msg.length * 60));
      timers.add(t);
    };
    window.addEventListener("omega-a11y-caption", onCap);
    return () => {
      window.removeEventListener("omega-a11y-caption", onCap);
      timers.forEach((t) => window.clearTimeout(t));
    };
  }, []);

  useEffect(() => {
    if (!("speechSynthesis" in window)) return;
    const synth = window.speechSynthesis;
    const original = synth.speak.bind(synth);
    const patched = (u: SpeechSynthesisUtterance) => {
      try {
        if (!ownUtterances.has(u) && u.text?.trim()) {
          const p = loadPrefs();
          window.dispatchEvent(new CustomEvent("omega-a11y-caption", { detail: { msg: u.text, kind: "info", visible: p.subtitulos } }));
          vibrate("info");
        }
      } catch { /* nunca bloquear la voz */ }
      original(u);
    };
    synth.speak = patched;
    return () => {
      if (synth.speak === patched) delete (synth as unknown as Record<string, unknown>).speak;
    };
  }, []);

  // Describe el canvas 3D para lectores de pantalla sin modificar HologramScene.tsx.
  useEffect(() => {
    const LABEL = "Holograma 3D interactivo de OMEGA. Se controla con la voz o con gestos de la mano ante la cámara.";
    let raf = 0;
    const label = () => {
      raf = 0;
      document.querySelectorAll("canvas").forEach((c) => {
        if (c.hasAttribute("aria-label") || c.hasAttribute("role") || c.closest("[aria-hidden='true']")) return;
        const r = c.getBoundingClientRect();
        if (r.width < 120 || r.height < 120) return;
        c.setAttribute("role", "img");
        c.setAttribute("aria-label", LABEL);
      });
    };
    const schedule = () => { if (!raf) raf = requestAnimationFrame(label); };
    schedule();
    const timers = [2000, 6000].map((ms) => window.setTimeout(schedule, ms));
    const mo = new MutationObserver(schedule);
    mo.observe(document.body, { childList: true, subtree: true });
    return () => {
      mo.disconnect();
      timers.forEach((t) => window.clearTimeout(t));
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);
  const skip = (e: ReactMouseEvent<HTMLAnchorElement>) => {
    const m = document.querySelector<HTMLElement>("main, [role='main']");
    if (!m) return;
    e.preventDefault();
    if (!m.hasAttribute("tabindex")) m.setAttribute("tabindex", "-1");
    m.focus();
  };

  return (
    <>
      <div className="omega-fx" aria-hidden="true">
        <span className="omega-fx__grid" />
        <span className="omega-fx__scan" />
        <span className="omega-fx__c omega-fx__c--tl" />
        <span className="omega-fx__c omega-fx__c--tr" />
        <span className="omega-fx__c omega-fx__c--bl" />
        <span className="omega-fx__c omega-fx__c--br" />
      </div>
      <a href="#" className="omega-skip-link" onClick={skip}>Saltar al contenido principal</a>
      <div className="omega-a11y-root">
        <OmegaAccessibleMenu />
      </div>
      <div className="omega-captions" role="status" aria-live="polite">
        {captions.map((c) => (
          <p key={c.id} className={`omega-caption omega-caption--${c.kind}${c.visible ? "" : " omega-sr-only"}`}>{c.msg}</p>
        ))}
      </div>
      <OmegaSupervisor />
    </>
  );
}