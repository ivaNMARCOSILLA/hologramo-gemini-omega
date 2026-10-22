param(
    [ValidateSet("base", "small")][string]$Model = "small",
    [ValidateRange(4,30)][int]$Seconds = 10
)
$ErrorActionPreference = "Stop"
$root = Join-Path $env:USERPROFILE "Desktop\OMEGA-256D-HYPERSPACE\Obj4K9D\holograma-gemini"
$py = Join-Path $root "omega-operator-v2\.venv-whisper\Scripts\python.exe"
$src = Join-Path $PSScriptRoot "omega_operator_v4.py"
if (-not (Test-Path $py)) { throw "Falta el Python local de OMEGA." }
if (-not (Test-Path $src)) { throw "Falta OMEGA OPERADOR 4." }
$env:HF_HUB_DISABLE_SYMLINKS_WARNING = "1"
$env:PYTHONIOENCODING = "utf-8"
& $py -X utf8 $src --model $Model --seconds $Seconds
exit $LASTEXITCODE