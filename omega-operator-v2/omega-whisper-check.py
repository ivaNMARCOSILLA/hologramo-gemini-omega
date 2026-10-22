import sys
from faster_whisper import WhisperModel

print("Python:", sys.version.split()[0], flush=True)
print("Cargando Whisper base...", flush=True)

model = WhisperModel(
    "base",
    device="cpu",
    compute_type="int8"
)

print("WHISPER: MODELO CARGADO CORRECTAMENTE", flush=True)