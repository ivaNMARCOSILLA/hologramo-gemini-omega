$ErrorActionPreference = 'Stop'
$dir = Split-Path -Parent $MyInvocation.MyCommand.Path
$python = Join-Path (Split-Path -Parent $dir) 'omega-operator-v2\.venv-whisper\Scripts\python.exe'
$program = Join-Path $dir 'omega_operador_v5.py'
$env:HF_HUB_DISABLE_SYMLINKS_WARNING = '1'
$env:PYTHONIOENCODING = 'utf-8'
& $python -X utf8 $program --model small --seconds 10
exit $LASTEXITCODE