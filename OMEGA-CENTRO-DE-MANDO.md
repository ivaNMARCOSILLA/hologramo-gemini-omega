# HOLOGRAMA-GEMINI — OMEGA UNIFIED v0.6

Proyecto principal (se respeta su ruta): `holograma-gemini`.

## Modulos integrados
- Base: `app/page.tsx` y `components/HologramScene.tsx` (holograma, gestos, cámara, voz original).
- OMEGA Windows v0.3: `omega-agent-v0.3/` y `app/api/omega-windows/` (agente con token y consentimiento por acción).
- Reparación v0.4: protección de origen `POST` y diagnóstico seguro dentro de la API Windows.
- Panel unificado v0.5: `components/OmegaUnifiedPanel.tsx`, `app/omega-v05.css`, `lib/omega-router-v05.ts` y recetas en `data/`.
- v0.6: `app/api/omega-market/route.ts`, `lib/omega-market-v06.ts`, pruebas y una pestaña IA avanzada dentro del mismo panel.

No se borran los directorios históricos v0.1/v0.2, si existen. No se mueve el proyecto ni se cambia el modelo 3D. El backend original `/api/chat` se conserva para la opción estándar.

## Qué hace realmente la IA de pago
- Es un consultor: contesta, redacta y genera un plan de Windows o código.
- No descarga ejecutables desconocidos, no navega el escritorio por sí solo, no ejecuta lo que redacta y no confirma UAC.
- Solo el motor local existente puede solicitar aperturas de una lista autorizada; mantiene confirmación en Windows.
- Los modelos propietarios funcionan en los servidores de sus fabricantes; se llama por API, NO se descarga su modelo a tu PC.

## Control de gasto
El modo de pago nace **desactivado**. Para activarlo: `CONFIGURAR-MERCADO-IA.cmd`, clave personal de OpenRouter y presupuesto elegido. Configura además el **límite mensual de la clave** en https://openrouter.ai/keys (o Guardrails) y no actives las recargas automáticas de créditos. No se realiza ningún cobro o consulta con coste durante la instalación.

El registro `omega-local-data/market-usage-v06.json` muestra un **importe local orientativo**, no el importe facturado ni un límite infalible. La cuenta OpenRouter es la fuente oficial del consumo. Con una clave de límite mensual puedes acotar los gastos en el proveedor.

Fuentes verificadas el 21 de octubre de 2026:
- https://openrouter.ai/pricing/
- https://openrouter.ai/anthropic/claude-sonnet-4.6/pricing
- https://openrouter.ai/google/gemini-3.1-pro-preview
- https://openrouter.ai/openai/gpt-5.5
- https://openrouter.ai/docs/api/api-reference/api-keys/get-current-key
- https://openrouter.ai/docs/guides/features/guardrails/overview

## Seguridad y privacidad
- El endpoint `omega-market` solo acepta navegador del mismo origen en modo `next dev` local.
- API key almacenada solo en `.env.local` del servidor. No se incluye en bundle JS ni en descargas.
- El texto enviado como consulta sale hacia OpenRouter y el proveedor del modelo. **No mandes información sensible.**
- No se envían automáticamente archivos locales, imágenes de cámara, audio ni textos del portapapeles al proveedor.
- Los costes no están incluidos en ChatGPT Plus ni otras suscripciones. Las API tienen facturación independiente.

## Compatibilidad
Node.js moderno y el Windows donde ya funciona OMEGA. Windows XP requiere un agente diferente, validación y sandbox; no es compatible con Node 24/Next 16 actuales. No se garantiza una versión futura no publicada.


## v0.6.2 — Código por voz y holograma miniatura
- Apartado **Código por voz** en el mismo panel, sin otra ventana ni otro proyecto.
- Reutiliza el `SpeechRecognition` de `app/page.tsx`. Dictado puntual y órdenes que empiecen por «programa», «crea un script», «genera una función», etc.
- Detecta el lenguaje cuando la voz dice PowerShell, Python, JavaScript, TypeScript o CMD.
- Usa Ollama **local** (`/api/omega-code`) para generar una propuesta automáticamente al terminar de dictar, sin enviar la solicitud a proveedores de pago. Requiere Ollama y el modelo ya descargados en el equipo.
- Si se selecciona OpenRouter, el dictado **nunca cobra**: el usuario debe pulsar **Generar con IA de pago · confirmar consulta** antes de cada solicitud. El resultado es texto que se puede corregir, copiar y descargar como archivo.
- El holograma 3D original permanece en su sitio. Una versión diminuta visual `Ω` aparece al lado de la orden y editor, animándose en escucha, escritura y síntesis de voz. Tras finalizar una orden dictada con Ollama se lee una confirmación breve por el mismo sintetizador de voz de la página y se anima el holograma 3D. No hay sincronización labial fonética.
- **Nunca se ejecuta código generado, no se guardan archivos automáticamente en el proyecto y no se acepta UAC.**
- Endpoint nuevo disponible solo en desarrollo local, con comprobación de origen y Ollama limitado a loopback.
- Test de la ruta local (6 pruebas), catálogo y ruta comercial (11 pruebas), además de test de sintaxis TS/TSX en el entorno de preparación. La compilación completa `tsc --noEmit` se ejecuta en tu PC durante la instalación y restaura los cambios si falla.
