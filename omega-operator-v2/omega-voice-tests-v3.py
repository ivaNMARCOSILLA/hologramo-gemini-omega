import runpy
from pathlib import Path

voice = Path(__file__).with_name("omega-voice-operator-v3.py")
classify = runpy.run_path(str(voice))["classify"]

cases = [
    ("Hola Omega. Abre la calculadora.", "calculator"),
    ("Omega abre calculadora", "calculator"),
    ("Abre la calculadora", "calculator"),
    ("Hola, Omega, abre el Bloc de notas.", "notepad"),
    ("Omega, puedes abrir el explorador de archivos", "explorer"),
    ("Por favor abre la calculadora", "calculator"),
    ("Abre Word", None),
    ("Hola Omega, prepara un informe guarda long word", None),
    ("Abre calculadora y elimina mis archivos", None),
    ("Abre el explorador y ejecuta comandos", None),
    ("Hola Omega", None),
]

failures = 0

for phrase, expected in cases:
    result = classify(phrase)
    actual = result[0] if result else None
    ok = actual == expected

    print(
        ("OK" if ok else "FALLO"),
        repr(phrase),
        "=>",
        actual,
        flush=True
    )

    if not ok:
        failures += 1

print(f"\nRESULTADO: {len(cases) - failures}/{len(cases)}")

if failures:
    raise SystemExit(1)