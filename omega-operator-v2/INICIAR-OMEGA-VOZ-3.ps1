$ErrorActionPreference = "Stop"

$dir = Split-Path -Parent $MyInvocation.MyCommand.Path
$python = Join-Path $dir ".venv-whisper\Scripts\python.exe"
$voice = Join-Path $dir "omega-voice-operator-v3.py"

$env:HF_HUB_DISABLE_SYMLINKS_WARNING = "1"
$env:PYTHONIOENCODING = "utf-8"

& $python -X utf8 $voice --model small --seconds 10

exit $LASTEXITCODE