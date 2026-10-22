"""OMEGA voice 3.0: local microphone -> faster-whisper -> reviewed text.
No network APIs, shell execution, clipboard writes or remote bridge access.
First run downloads a speech model from Hugging Face; later runs can use cached model.
"""
import argparse
import sys


def main():
    p = argparse.ArgumentParser()
    p.add_argument('--model', default='small', choices=['tiny','base','small','medium','large-v3'])
    p.add_argument('--seconds', type=int, default=8)
    p.add_argument('--device', default='cpu', choices=['cpu','cuda'])
    args = p.parse_args()
    if not 1 <= args.seconds <= 30:
        p.error('--seconds must be 1..30')
    try:
        import numpy as np
        import sounddevice as sd
        from faster_whisper import WhisperModel
    except ImportError as exc:
        print(f'Dependencia ausente: {exc}', file=sys.stderr)
        return 2
    sample_rate = 16000
    print(f'OMEGA VOZ 3.0 | Grabando {args.seconds} segundos. Habla ahora...', flush=True)
    try:
        audio = sd.rec(int(args.seconds * sample_rate), samplerate=sample_rate,
                       channels=1, dtype='float32')
        sd.wait()
        audio = np.squeeze(audio)
        if np.max(np.abs(audio)) < 0.003:
            print('Micrófono sin señal suficiente. Revisa permisos y entrada.', file=sys.stderr)
            return 3
        print('Transcribiendo localmente (la primera vez puede descargar el modelo)...', flush=True)
        model = WhisperModel(args.model, device=args.device,
                             compute_type='int8' if args.device == 'cpu' else 'float16')
        segments, _ = model.transcribe(audio, language='es', beam_size=5,
                                       vad_filter=True, condition_on_previous_text=False)
        result = ' '.join(segment.text.strip() for segment in segments).strip()
        if not result:
            print('No se detectó voz reconocible.')
            return 4
        print('\n=== TRANSCRIPCION (NO EJECUTADA) ===')
        print(result)
        print('=== FIN ===')
        return 0
    except Exception as exc:
        print(f'Error de audio/transcripcion: {exc}', file=sys.stderr)
        return 1


if __name__ == '__main__':
    sys.exit(main())
