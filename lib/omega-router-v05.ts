// OMEGA UNIFIED v0.5: interpretador local puro, sin shell ni efectos secundarios.
export type RecipeId = 'APP-CALC-01' | 'APP-NOTE-02' | 'APP-EXP-03' | 'SYS-READ-01' | 'CLIP-10' | 'VOICE-12' | 'SIGN-VIS-13';
export type OmegaPlan =
  | { status: 'matched'; recipeId: RecipeId; intent: string; permission: 'read' | 'confirm_each' | 'browser_gesture'; title: string; detail: string }
  | { status: 'human_review'; reason: string }
  | { status: 'needs_model'; reason: string }
  | { status: 'invalid'; reason: string };

const clean = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[¡!¿?.,;:]/g, ' ').replace(/\s+/g, ' ').trim();
const unsafe = /\b(borra|borrar|elimina|eliminar|destruye|formatea|format|powershell|cmd|regedit|uac|administrador|contrasena|password|clave privada|paga|pagar|transferir|transferencia|desactiva seguridad|evade|omitir permisos|sin permiso|reinicia|apaga|apagar)\b/;
const apps = [
  { recipeId: 'APP-CALC-01' as const, intent: 'open_calculator', title: 'Abrir calculadora', pattern: /\b(calculadora|calculator|calc)\b/ },
  { recipeId: 'APP-NOTE-02' as const, intent: 'open_notepad', title: 'Abrir Bloc de notas', pattern: /\b(bloc de notas|notepad)\b/ },
  { recipeId: 'APP-EXP-03' as const, intent: 'open_explorer', title: 'Abrir Explorador', pattern: /\b(explorador de archivos|explorador|explorer)\b/ },
];
export function routeOmegaIntent(input: string): OmegaPlan {
  if (typeof input !== 'string' || input.length > 180 || !input.trim()) return { status: 'invalid', reason: 'Orden vacía o demasiado larga (máximo 180 caracteres).' };
  const text = clean(input);
  if (unsafe.test(text)) return { status: 'human_review', reason: 'La orden contiene una operación sensible o peligrosa. Requiere revisión humana; no se ejecutará.' };
  if (/\b(abre|abrir|inicia|iniciar|ejecuta|ejecutar)\b/.test(text)) {
    const matches = apps.filter(app => app.pattern.test(text));
    if (matches.length > 1) return { status: 'human_review', reason: 'Hay varias aplicaciones en la orden. Indica solo una.' };
    if (matches.length === 1) return { status: 'matched', ...matches[0], permission: 'confirm_each', detail: 'El agente Windows pedirá permiso para abrir esta aplicación.' };
  }
  if (/\b(diagnostico|diagnostica|revisa|estado|informacion)\b/.test(text) && /\b(windows|equipo|sistema|pc)\b/.test(text))
    return { status: 'matched', recipeId: 'SYS-READ-01', intent: 'diagnose_system', title: 'Diagnóstico Windows', permission: 'read', detail: 'Consulta de CPU, memoria y versión; sin modificaciones.' };
  if (/\b(copia|copiar|pega|pegar|portapapeles)\b/.test(text))
    return { status: 'matched', recipeId: 'CLIP-10', intent: 'clipboard', title: 'Editor y portapapeles', permission: 'browser_gesture', detail: 'Solo con el texto que introduzcas y permisos del navegador.' };
  if (/\b(firma|firmar|rubrica)\b/.test(text))
    return { status: 'matched', recipeId: 'SIGN-VIS-13', intent: 'visual_signature', title: 'Firma visual', permission: 'browser_gesture', detail: 'Dibuja y exporta una imagen PNG no certificada.' };
  if (/\b(voz|dictar|dictado|microfono)\b/.test(text))
    return { status: 'matched', recipeId: 'VOICE-12', intent: 'dictate', title: 'Dictado por voz', permission: 'browser_gesture', detail: 'Requiere gesto y permiso del micrófono.' };
  return { status: 'needs_model', reason: 'No existe una receta autorizada para esta orden. Puedes consultarla con OMEGA, pero no se ejecutará en Windows.' };
}
