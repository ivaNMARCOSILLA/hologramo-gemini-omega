import runpy
from pathlib import Path

path = Path(__file__).with_name("omega-voice-operator-v3.py")
classify = runpy.run_path(str(path))["classify"]

cases = [
    ("Hola Omega. Abre la calculadora.", "calculator"),
    ("Ola Omega. Abre la calculadora.", "calculator"),
    ("Omega abre calculadora", "calculator"),
    ("Abre la calculadora", "calculator"),

    ("Ola Omega. Abre el Bloc de notas.", "notepad"),
    ("Hola Omega, abre el Bloc de notas.", "notepad"),
    ("Omega abre bloc de notas", "notepad"),
    ("Abre el Bloc de notas", "notepad"),

    ("Ola Omega. Abre el explorador.", "explorer"),
    ("Hola Omega, abre el explorador.", "explorer"),
    ("Omega abre el explorador de archivos", "explorer"),
    ("Abre explorador", "explorer"),

    ("Hola Omega", None),
    ("Ola Omega", None),
    ("Abre Word", None),
    ("Abre calculadora y borra archivos", None),
    ("Abre el explorador y ejecuta comandos", None),
    ("Prepara un informe y guardalo en Word", None),
]

failures = 0

for phrase, expected in cases:
    result = classify(phrase)
    actual = result[0] if result else None

    if actual == expected:
        print("OK   |", phrase, "=>", actual)
    else:
        print("ERROR|", phrase, "=>", actual, "esperado:", expected)
        failures += 1

print(f"\nRESULTADO: {len(cases) - failures}/{len(cases)}")

if failures:
    raise SystemExit(1)