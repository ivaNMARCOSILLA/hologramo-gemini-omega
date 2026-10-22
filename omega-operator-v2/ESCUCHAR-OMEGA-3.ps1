param([ValidateRange(1,30)][int]$Seconds=8,[ValidateSet('tiny','base','small','medium','large-v3')][string]$Model='small')
$ErrorActionPreference='Stop'
$python=Join-Path $PSScriptRoot '.venv-whisper\Scripts\python.exe'
$program=Join-Path $PSScriptRoot 'omega_whisper.py'
if (-not (Test-Path $python)) { throw 'Falta el entorno local Whisper.' }
& $python $program --seconds $Seconds --model $Model
if ($LASTEXITCODE -ne 0) { throw "Whisper terminÃ³ con cÃ³digo $LASTEXITCODE" }
