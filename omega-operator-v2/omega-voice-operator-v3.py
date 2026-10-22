import argparse
import math
import re
import subprocess
import sys
import unicodedata
from pathlib import Path

import numpy as np
import sounddevice as sd
from faster_whisper import WhisperModel

ROOT = Path(__file__).resolve().parent
COMMAND_SCRIPT = ROOT / "omega-command.ps1"
SAMPLE_RATE = 16000

def normalize(text):
    text = unicodedata.normalize("NFKD", text.lower())
    text = "".join(
        char for char in text
        if not unicodedata.combining(char)
    )
    text = re.sub(r"[^\w\s]", " ", text)
    return re.sub(r"\s+", " ", text).strip()

def classify(text):
    phrase = normalize(text)

    # Aceptar saludos habituales dirigidos a OMEGA.
    phrase = re.sub(
        r"^(?:(?:hola|ola|oye|buenos dias|buenas tardes|buenas noches)\s+)?omega\s+",
        "",
        phrase,
        count=1
    )

    # Solo solicitudes completas de apertura.
    pattern = (
        r"^(?:por favor\s+)?"
        r"(?:abre|abrir|inicia|ejecuta|puedes abrir|"
        r"podrias abrir|quiero que abras|me abres)\s+"
        r"(?:(?:la|el)\s+)?"
        r"(explorador de archivos|bloc de notas|"
        r"calculadora|calculator|notepad|explorador|carpetas)"
        r"(?:\s+por favor)?$"
    )

    match = re.fullmatch(pattern, phrase)

    if not match:
        return None

    target = match.group(1)

    if target in ("calculadora", "calculator"):
        return ("calculator", "OMEGA abre calculadora")

    if target in ("bloc de notas", "notepad"):
        return ("notepad", "OMEGA abre bloc de notas")

    if target in (
        "explorador",
        "explorador de archivos",
        "carpetas"
    ):
        return ("explorer", "OMEGA abre explorador")

    return None

def record(seconds):
    print(f"\nGRABANDO {seconds} SEGUNDOS. Habla ahora...", flush=True)

    samples = sd.rec(
        int(seconds * SAMPLE_RATE),
        samplerate=SAMPLE_RATE,
        channels=1,
        dtype="float32"
    )
    sd.wait()

    audio = np.asarray(samples[:, 0], dtype=np.float32)

    peak = float(np.max(np.abs(audio)))
    rms = float(np.sqrt(np.mean(np.square(audio))))

    print(f"Audio: peak={peak:.4f} | rms={rms:.4f}", flush=True)

    return audio, peak, rms

def transcribe(model, audio):
    segments, info = model.transcribe(
        audio,
        language="es",
        beam_size=5,
        vad_filter=True,
        condition_on_previous_text=False,
        initial_prompt=(
            "Omega. Abre la calculadora. "
            "Abre el Bloc de notas. "
            "Abre el explorador de archivos."
        )
    )

    text = " ".join(
        segment.text.strip()
        for segment in segments
    ).strip()

    return text

def execute(command):
    name, canonical_order = command

    if name not in {"calculator", "notepad", "explorer"}:
        raise RuntimeError("Aplicacion fuera de la lista autorizada.")

    if not COMMAND_SCRIPT.is_file():
        raise RuntimeError("No existe el interprete de OMEGA.")

    process = subprocess.run(
        [
            "powershell.exe",
            "-NoProfile",
            "-NonInteractive",
            "-ExecutionPolicy",
            "Bypass",
            "-File",
            str(COMMAND_SCRIPT),
            "-Order",
            canonical_order
        ],
        capture_output=True,
        text=True,
        errors="replace",
        timeout=30
    )

    if process.stdout.strip():
        print(process.stdout.strip(), flush=True)

    if process.returncode != 0:
        raise RuntimeError(
            process.stderr.strip()
            or f"Codigo de salida: {process.returncode}"
        )

    print(f"OMEGA: orden enviada al interprete local ({name}).")

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", default="base",
                        choices=["base", "small"])
    parser.add_argument("--seconds", type=int, default=8)
    args = parser.parse_args()

    if not 3 <= args.seconds <= 30:
        parser.error("La grabacion debe durar entre 3 y 30 segundos.")

    print("=" * 52)
    print("OMEGA VOZ 3.0 | OPERADOR LOCAL")
    print("=" * 52)

    print("Cargando Whisper local...", flush=True)
    model = WhisperModel(
        args.model,
        device="cpu",
        compute_type="int8"
    )

    print("WHISPER PREPARADO.")
    print("Pulsa INTRO para hablar, o escribe Q para salir.")
    print("Ordenes: abre calculadora / bloc de notas / explorador.")
    print("Las ordenes no autorizadas NO se ejecutan.")

    while True:
        try:
            choice = input("\nOMEGA > ").strip().lower()
        except (EOFError, KeyboardInterrupt):
            break

        if choice in ("q", "salir", "exit"):
            break

        if choice:
            print("Pulsa INTRO sin escribir nada para escuchar.")
            continue

        try:
            audio, peak, rms = record(args.seconds)

            if peak < 0.005 or rms < 0.001:
                print("OMEGA: senal demasiado debil. No se ejecuta nada.")
                continue

            print("Transcribiendo localmente...", flush=True)
            text = transcribe(model, audio)

            if not text:
                print("OMEGA: no se ha detectado una frase clara.")
                continue

            print(f"RECONOCIDO: {text}", flush=True)

            command = classify(text)

            if command is None:
                print("OMEGA: texto recibido, sin accion autorizada.")
                continue

            execute(command)

        except KeyboardInterrupt:
            print("\nGrabacion interrumpida.")
        except Exception as exc:
            print(f"OMEGA ERROR: {type(exc).__name__}: {exc}")

    print("OMEGA VOZ 3.0 detenido.")

if __name__ == "__main__":
    main()