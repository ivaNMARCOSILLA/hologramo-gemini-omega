"use client";
import { useEffect } from "react";

/**
 * OMEGA dictado siempre activo v1. Pulsa el botón existente «Dictar orden» al cargar
 * (solo si el micrófono ya tiene permiso). «cancelar» lo pausa hasta recargar.
 * Desactivar del todo: localStorage.setItem('omega:dictado-siempre','false').
 */
function findDictateButton(): HTMLButtonElement | null {
  return Array.from(document.querySelectorAll<HTMLButtonElement>("button"))
    .find((b) => !b.disabled && b.textContent?.trim() === "Dictar orden") ?? null;
}

export default function OmegaVoiceAlwaysOn() {
  useEffect(() => {
    let off = false;
    try { off = window.localStorage.getItem("omega:dictado-siempre") === "false"; } catch { /* sin almacenamiento */ }
    if (off) return;
    let paused = false;
    const timers: number[] = [];
    const arm = async () => {
      if (paused || document.visibilityState !== "visible") return;
      try {
        const st = await navigator.permissions.query({ name: "microphone" as PermissionName });
        if (st.state !== "granted") return;
      } catch { return; }
      findDictateButton()?.click();
    };
    const onCancel = () => { paused = true; };
    const onVisible = () => { if (document.visibilityState === "visible") timers.push(window.setTimeout(() => { void arm(); }, 1500)); };
    timers.push(window.setTimeout(() => { void arm(); }, 2500));
    window.addEventListener("omega:voice-cancel", onCancel);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      timers.forEach((t) => window.clearTimeout(t));
      window.removeEventListener("omega:voice-cancel", onCancel);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);
  return null;
}