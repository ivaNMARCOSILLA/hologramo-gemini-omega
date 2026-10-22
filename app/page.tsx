"use client";

import { useState, useRef, useEffect } from "react";
import HologramScene from "@/components/HologramScene";
import OmegaUnifiedPanel from "@/components/OmegaUnifiedPanel";
import { routeOmegaCommand } from "@/lib/omega-command-v11"; // OMEGA_VOICE_TOTAL_V11
import { omegaLocalAnswer } from "@/lib/omega-voz-dictadora"; // OMEGA_VOZ_LOCAL_V1
import { routeVoiceShortcut } from "@/lib/omega-av-v07"; // OMEGA_VOZ_DICTADORA_V1
import "./omega-v05.css";
import "./omega-v09.css";
import OmegaScreen, { type OmegaScreenHandle } from "@/components/OmegaScreen";
import { 
  Send, Volume2, Hand, Grab, Radio, Terminal,
  Maximize2, Minimize2, Shapes, Mic, MicOff, Camera, CameraOff, Sparkles
} from "lucide-react";

function classifyEmotion(message: string): string {
  const t = message.toLowerCase();
  if (/peligro|urgente|alerta|cuidado|error|riesgo|atención/.test(t)) return 'alert';
  if (/feliz|alegr|genial|fantástic|increíble|celebr|enhorabuena|excelente/.test(t)) return 'joy';
  if (/triste|siento|comprendo|acompaño|ánimo|lamento|empat/.test(t)) return 'empathy';
  if (/tranquil|calma|respira|seren|relaja|paz/.test(t)) return 'calm';
  if (/imagina|explor|descubr|curios|posibilidad|hipótesis|investig/.test(t)) return 'curiosity';
  return 'neutral';
}

export default function Home() {
  const screenRef = useRef<OmegaScreenHandle>(null);
  const [inputText, setInputText] = useState("");
  const [omegaResponse, setOmegaResponse] = useState("NÚCLEO 256D EN LÍNEA. Enjambre geométrico sincronizado a tu mano y voz.");
  const [lastUserVoice, setLastUserVoice] = useState("");
  const [liveTranscript, setLiveTranscript] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [emotion, setEmotion] = useState('neutral');
  const [cameraStatus, setCameraStatus] = useState<'connecting' | 'active' | 'blocked'>('blocked');
  const [cameraEnabled, setCameraEnabled] = useState(false);
  const [micStatus, setMicStatus] = useState<'idle' | 'listening' | 'blocked' | 'unsupported'>('idle');
  const [conversationEnabled, setConversationEnabled] = useState(false);
  const conversationRef = useRef(false);
  const windowsDictationRef = useRef(false);
  const codeDictationRef = useRef(false); // OMEGA_CODE_V062
  const editorDictationRef = useRef(false); // OMEGA_AV_V07: un solo microfono para todas las herramientas
  const processingRef = useRef(false);
  const speakingNowRef = useRef(false);
  const restartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Escala fija inicial para que repose en la palma
  const [userScale, setUserScale] = useState(1.0);
  const [dynamicMultiplier, setDynamicMultiplier] = useState(1.0);

  // Posición y agarre
  const [handPos, setHandPos] = useState({ x: 0, y: -0.15, z: 0 });
  const [isGrabbing, setIsGrabbing] = useState(false);
  const [handDetected, setHandDetected] = useState(false);

  // Cámara web
  const videoRef = useRef<HTMLVideoElement>(null);
  const recognitionRef = useRef<any>(null);
  const isSpeakingRef = useRef(false);
  isSpeakingRef.current = isSpeaking;

  // 1. Cámara y Visión Artificial
  useEffect(() => {
    let hands: any = null;
    let cameraUtil: any = null;
    let localStream: MediaStream | null = null;
    let isMounted = true;

    async function startCameraAndHands() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1920, min: 1280 },
            height: { ideal: 1080, min: 720 },
            facingMode: "user"
          },
          audio: false
        });

        if (!isMounted) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        localStream = stream;
        setCameraStatus('active');
        stream.getVideoTracks().forEach(track => { track.onended = () => { if (isMounted) setCameraStatus('blocked'); }; });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }

        const HandsModule = await import("@mediapipe/hands");


        hands = new HandsModule.Hands({
          locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
        });

        hands.setOptions({
          maxNumHands: 1,
          modelComplexity: 1,
          minDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5
        });

        hands.onResults((results: any) => {
          if (!isMounted) return;
          if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
            setHandDetected(true);
            const lm = results.multiHandLandmarks[0];

            const thumb = lm[4];
            const index = lm[8];

            const pinchDist = Math.hypot(thumb.x - index.x, thumb.y - index.y);
            const grabbing = pinchDist < 0.085;
            setIsGrabbing(grabbing);

            const pinchScale = Math.min(Math.max(pinchDist * 4.8, 0.6), 2.2);
            setDynamicMultiplier(pinchScale);

            const palm = lm[9];
            const targetX = (0.5 - palm.x) * 4.2;
            const targetY = (0.5 - palm.y) * 2.8;
            const targetZ = (0.15 - pinchDist) * 2.5;

            setHandPos({ x: targetX, y: targetY, z: targetZ });
          } else {
            setHandDetected(false);
            setIsGrabbing(false);
            setDynamicMultiplier(1.0);
          }
        });

        let busy = false;
        let frameId = 0;
        const analyze = async () => {
          if (!isMounted) return;
          if (!busy && videoRef.current?.readyState === 4) {
            busy = true;
            try { await hands.send({ image: videoRef.current }); } catch (error) { console.warn('MediaPipe:', error); }
            finally { busy = false; }
          }
          frameId = requestAnimationFrame(analyze);
        };
        frameId = requestAnimationFrame(analyze);
        cameraUtil = { stop: () => cancelAnimationFrame(frameId) };
      } catch (err) {
        console.warn("Fallo de cámara:", err);
        if (isMounted) setCameraStatus("blocked");
      }
    }

    if (cameraEnabled) {
      setCameraStatus("connecting");
      startCameraAndHands();
    } else {
      setCameraStatus("blocked");
      setHandDetected(false);
      setIsGrabbing(false);
      setHandPos({ x: 0, y: 0, z: 0 });
      setDynamicMultiplier(1);
    }

    return () => {
      isMounted = false;
      if (localStream) localStream.getTracks().forEach((t) => t.stop());
      if (cameraUtil) cameraUtil.stop();
      if (hands) hands.close();
    };
  }, [cameraEnabled]);

  // Conversación manos libres: solo se reinicia mientras el usuario la mantenga activada.
  const restartListening = () => {
    if (!conversationRef.current || processingRef.current || speakingNowRef.current) return;
    try { recognitionRef.current?.start(); } catch { /* Ya iniciada */ }
  };

  const speakVoice = (text: string) => {
    if (!("speechSynthesis" in window)) { speakingNowRef.current = false; restartListening(); return; }
    window.speechSynthesis.cancel();
    speakingNowRef.current = true;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'es-ES';
    utterance.rate = 1.03;
    utterance.pitch = 0.94;
    const voices = window.speechSynthesis.getVoices();
    utterance.voice = voices.find(v => v.lang.startsWith('es') && /jorge|david|male/i.test(v.name)) || voices.find(v => v.lang.startsWith('es')) || null;
    utterance.onstart = () => setIsSpeaking(true);
    const done = () => { speakingNowRef.current = false; setIsSpeaking(false); if (conversationRef.current) setTimeout(restartListening, 400); };
    utterance.onend = done;
    utterance.onerror = done;
    window.speechSynthesis.speak(utterance);
  };

  // OMEGA_VOICE_DEVICE_COMMANDS
  const handleDeviceCommand = async (query: string): Promise<boolean> => {
    const normalized = query
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[.,!?¿¡]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    const say = (message: string) => {
      setOmegaResponse(message);
      speakVoice(message);
    };

    if (/\b(enciende|activa|prende|inicia)\b.*\b(camara|webcam)\b/.test(normalized)) {
      setCameraEnabled(true);
      say("Activando la cámara.");
      return true;
    }

    if (/\b(apaga|desactiva|deten|detiene)\b.*\b(camara|webcam)\b/.test(normalized)) {
      setCameraEnabled(false);
      say("Cámara desactivada.");
      return true;
    }

    if (
      /\b(comparte|compartir|muestra|mostrar)\b.*\b(pantalla|escritorio)\b/.test(normalized) ||
      /\b(inicia|activa)\b.*\b(compartir|comparticion)\b.*\bpantalla\b/.test(normalized)
    ) {
      const started = await screenRef.current?.start();

      if (started) {
        say("Pantalla compartida. Ya puedes pedirme que la analice.");
      } else {
        say("Para compartir pantalla, selecciona una ventana o pantalla y confirma el permiso del navegador. Si el navegador bloquea la orden de voz, utiliza el botón de compartir.");
      }

      return true;
    }

    if (
      /\b(deja|deten|detiene|para|termina)\b.*\b(compartir|comparticion)\b/.test(normalized) ||
      /\b(deja|deten|detiene|para)\b.*\bpantalla\b/.test(normalized)
    ) {
      screenRef.current?.stop();
      say("He detenido la pantalla compartida.");
      return true;
    }

    return false;
  };
  // OMEGA_CODE_V062: respuesta oral breve sincronizada con el holograma 3D original.
  useEffect(() => {
    const onCodeSpoken = (event: Event) => {
      const message = (event as CustomEvent<string>).detail;
      if (typeof message === 'string' && message.length <= 160) speakVoice(message);
    };
    window.addEventListener('omega:voice-summary', onCodeSpoken);
    return () => window.removeEventListener('omega:voice-summary', onCodeSpoken);
  }, []);
  const processQuery = async (query: string) => {
    const clean = query.trim();
    if (!clean || processingRef.current) return;

    // Acciones de dispositivos: sin llamada a Ollama
    if (await handleDeviceCommand(clean)) return;
    processingRef.current = true;
    try { recognitionRef.current?.stop(); } catch {}
    setMicStatus('idle');
    setLastUserVoice(clean);
    // OMEGA_VOZ_LOCAL_V1: preguntas sencillas se responden sin IA.
    const localReply = omegaLocalAnswer(clean);
    if (localReply) {
      processingRef.current = false;
      setOmegaResponse(localReply);
      window.dispatchEvent(new CustomEvent('omega:av-feedback', { detail: localReply }));
      speakVoice(localReply);
      return;
    }
    setIsProcessing(true);
    setOmegaResponse('DESCIFRANDO LA SEÑAL NEURAL…');
    window.dispatchEvent(new CustomEvent('omega:av-feedback', { detail: 'Procesando tu petición: ' + clean.slice(0, 150) }));
    setEmotion('curiosity');
    try {
      const res = await fetch('/api/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: clean, image: screenRef.current?.capture() ?? undefined })
      });
      if (!res.ok) throw new Error('API ' + res.status);
      const data = await res.json();
      const reply = data.reply || 'Frecuencia procesada en el enjambre.';
      setOmegaResponse(reply);
      window.dispatchEvent(new CustomEvent('omega:av-feedback', { detail: 'Respuesta: ' + reply.slice(0, 280) }));
      setEmotion(classifyEmotion(reply));
      speakVoice(reply);
    } catch (err) {
      const fallback = /API 40[13]/.test(String(err)) ? 'Esa orden no la reconozco, y la IA solo responde al administrador con sesión iniciada. Di «ayuda» para oír las órdenes disponibles.' : 'No he podido conectar con el núcleo de inteligencia. Comprueba la conexión y vuelve a intentarlo.';
      setOmegaResponse(fallback);
      window.dispatchEvent(new CustomEvent('omega:av-feedback', { detail: fallback }));
      setEmotion('alert');
      speakVoice(fallback);
    } finally { processingRef.current = false; setIsProcessing(false); }
  };

  useEffect(() => {
    const Recognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!Recognition) { setMicStatus('unsupported'); return; }
    const recognition = new Recognition();
    recognition.lang = 'es-ES';
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.onstart = () => setMicStatus('listening');
    recognition.onresult = (event: any) => {
      if (speakingNowRef.current || processingRef.current) return;
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          let transcript = event.results[i][0].transcript.trim();
          // OMEGA_V09_ACCESSIBLE_UNIFIED: palabra de activacion opcional. NO es reconocimiento de hablante.
          let wake = false;
          try { wake = window.localStorage.getItem('omega:v09:wakeword') === 'true'; } catch {}
          if (wake) {
            const match = transcript.match(/^(?:oye\s+)?omega[\s,:;.!-]+(.+)/i);
            if (!match) { window.dispatchEvent(new CustomEvent('omega:av-feedback', { detail: 'Di OMEGA al comenzar tu orden.' })); break; }
            transcript = match[1].trim();
          }
          if (transcript.length > 1) {
            setLiveTranscript('');
            setLastUserVoice(transcript);
            // OMEGA_VOICE_TOTAL_V11: voz y texto usan el MISMO interprete local.
            // El microfono especializado sigue siendo dictado literal, no ejecuta ordenes.
            // OMEGA_CANCELAR_VOZ_V1: «cancelar», «cerrar», «anular» o «no» como frase completa CANCELAN. Nunca aprueban.
            if (/^(?:oye\s+)?(?:omega\s+)?(?:cancelar?|cancela|cerrar?|cierra|anular?|anula|no)$/i.test(transcript.replace(/[.,;:!?¡¿]+/g, '').trim())) {
              editorDictationRef.current = false;
              codeDictationRef.current = false;
              windowsDictationRef.current = false;
              window.dispatchEvent(new CustomEvent('omega:voice-cancel'));
            } else if (editorDictationRef.current) {
              editorDictationRef.current = false;
              window.dispatchEvent(new CustomEvent('omega:voice-editor', { detail: transcript }));
            } else if (codeDictationRef.current) {
              codeDictationRef.current = false;
              window.dispatchEvent(new CustomEvent('omega:voice-code', { detail: transcript }));
            } else if (windowsDictationRef.current && (() => { try { return window.localStorage.getItem('omega:dictado-continuo') !== 'false'; } catch { return true; } })()) {
              // OMEGA_DICTADO_CONTINUO_V1: dictado siempre encendido y automático (sin "Enviar orden" ni revisión).
              // Windows sigue pidiendo permiso en el PC. Se ignora lo que OMEGA dice en voz alta (eco).
              if (!window.speechSynthesis?.speaking) {
                const said = transcript.replace(/[.,;:!?¡¿]+$/g, '').trim();
                const auto = routeOmegaCommand(said);
                if (auto) window.dispatchEvent(new CustomEvent('omega:unified-command', { detail:{ instruction: auto, via:'voice' } }));
                else window.dispatchEvent(new CustomEvent('omega:av-feedback', { detail: 'No reconozco «' + said.slice(0, 80) + '». Sigo escuchando. Di «ayuda» o «cancelar».' }));
              }
            } else if (windowsDictationRef.current) {
              windowsDictationRef.current = false;
              // OMEGA_RUTA_VOZ_V1: si lo dictado no es una orden de Windows (navegar, idea, editor...), va al intérprete general.
              const dictated = routeOmegaCommand(transcript.replace(/[.,;:!?¡¿]+$/g, "").trim()) as { kind?: unknown } | null;
              if (dictated && !String(dictated.kind ?? '').startsWith('windows')) {
                window.dispatchEvent(new CustomEvent('omega:unified-command', { detail:{ instruction: dictated, via:'voice' } }));
              } else {
                window.dispatchEvent(new CustomEvent('omega:voice-order', { detail: transcript }));
              }
            } else {
              // OMEGA_VOZ_DICTADORA_V1: la voz manda. 1) intérprete v1.1; 2) si no reconoce la orden,
              // atajo v0.7 (abrir sección / guardar idea, con confirmación hablada); 3) solo entonces, la IA.
              const routed = routeOmegaCommand(transcript.replace(/[.,;:!?¡¿]+$/g, "").trim());
              const shortcut = routed ? null : routeVoiceShortcut(transcript);
              if (shortcut) {
                window.dispatchEvent(new CustomEvent('omega:av-command', { detail: shortcut }));
              } else {
                const instruction = routed || { kind:'ai_draft', text:transcript };
                window.dispatchEvent(new CustomEvent('omega:unified-command', { detail:{ instruction, via:'voice' } }));
              }
            }
            try { recognition.stop(); } catch {}
            break;
          }
        } else interim += event.results[i][0].transcript;
      }
      setLiveTranscript(interim);
    };
    recognition.onerror = (event: any) => {
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        conversationRef.current = false;
        setConversationEnabled(false);
        setMicStatus('blocked');
      } else setMicStatus('idle');
    };
    recognition.onend = () => {
      // OMEGA_DICTADO_CONTINUO_V1: reanudar la escucha si el dictado continuo sigue activo.
      if (windowsDictationRef.current && !processingRef.current) {
        window.setTimeout(() => { try { recognition.start(); } catch { /* ya está escuchando */ } }, 300);
      }
      setMicStatus(prev => prev === 'blocked' ? prev : 'idle');
      if (conversationRef.current && !processingRef.current && !speakingNowRef.current) {
        restartTimerRef.current = setTimeout(restartListening, 650);
      }
    };
    recognitionRef.current = recognition;
    return () => {
      conversationRef.current = false;
      if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
      recognition.abort();
      recognitionRef.current = null;
      window.speechSynthesis?.cancel();
    };
  }, []);

  const toggleConversation = () => {
    if (conversationRef.current) {
      conversationRef.current = false;
      setConversationEnabled(false);
      setMicStatus('idle');
      setLiveTranscript('');
      if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
      try { recognitionRef.current?.abort(); } catch {}
    } else {
      conversationRef.current = true;
      setConversationEnabled(true);
      restartListening();
    }
  };

  // OMEGA_UNIFIED_V05: dictado puntual compartiendo el mismo reconocedor de voz.
  const dictateWindows = () => {
    if (conversationRef.current) {
      conversationRef.current = false;
      setConversationEnabled(false);
      if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
      try { recognitionRef.current?.abort(); } catch {}
    }
    windowsDictationRef.current = true;
    codeDictationRef.current = false;
    editorDictationRef.current = false;
    setTimeout(() => {
      try { recognitionRef.current?.start(); }
      catch { windowsDictationRef.current = false; setMicStatus('blocked'); }
    }, 250);
  };
  // OMEGA_CODE_V062: dictado puntual de código sin segundo micrófono.
  const dictateCode = () => {
    if (conversationRef.current) {
      conversationRef.current = false;
      setConversationEnabled(false);
      if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
      try { recognitionRef.current?.abort(); } catch {}
    }
    codeDictationRef.current = true;
    windowsDictationRef.current = false;
    editorDictationRef.current = false;
    setTimeout(() => {
      try { recognitionRef.current?.start(); }
      catch { codeDictationRef.current = false; setMicStatus('blocked'); }
    }, 250);
  };
  // OMEGA_AV_V07: el editor usa el MISMO SpeechRecognition que conversación y código.
  const dictateEditor = () => {
    if (conversationRef.current) {
      conversationRef.current = false;
      setConversationEnabled(false);
      if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
      try { recognitionRef.current?.abort(); } catch {}
    }
    editorDictationRef.current = true;
    windowsDictationRef.current = false;
    codeDictationRef.current = false;
    setTimeout(() => {
      try { recognitionRef.current?.start(); }
      catch { editorDictationRef.current = false; setMicStatus('blocked'); }
    }, 250);
  };

  const finalEffectiveScale = userScale * (handDetected ? dynamicMultiplier : 1.0);

  // OMEGA_UNIFIED_V05 - holograma original, una sola superficie de control.
  return (
    <main className="omega-stage omega-v05-stage">
      <div className="omega-atmosphere" aria-hidden="true" />
      <div className="omega-scene omega-v05-scene">
        <HologramScene handPos={handPos} isGrabbing={isGrabbing}
          currentScale={finalEffectiveScale} isSpeaking={isSpeaking} emotion={emotion} />
      </div>
      <OmegaUnifiedPanel
        videoRef={videoRef} cameraStatus={cameraStatus} handDetected={handDetected}
        isGrabbing={isGrabbing} micStatus={micStatus} conversationEnabled={conversationEnabled}
        liveTranscript={liveTranscript} reply={omegaResponse} isProcessing={isProcessing}
        onToggleConversation={toggleConversation} onDictateWindows={dictateWindows} onDictateCode={dictateCode}
        onDictateEditor={dictateEditor} lastUserVoice={lastUserVoice} isSpeaking={isSpeaking}
        onAsk={processQuery}
      />
    </main>
  );
}