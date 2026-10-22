param(
    [Parameter(Mandatory=$true)]
    [string]$Order
)

$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Windows.Forms

function Open-OmegaApp {
    param([string]$App)

    switch ($App) {
        "notepad" { Start-Process "notepad.exe" }
        "calculator" { Start-Process "calc.exe" }
        "explorer" { Start-Process "explorer.exe" }
        default { throw "Aplicacion no autorizada." }
    }
}

$orderText = $Order.Trim().ToLowerInvariant()

Write-Host "`nOMEGA: interpretando orden..." -ForegroundColor Cyan

if ($orderText -match "abre.*(bloc de notas|notepad)") {
    Open-OmegaApp "notepad"
    Write-Host "OMEGA: Bloc de notas abierto." -ForegroundColor Green
}
elseif ($orderText -match "abre.*(calculadora|calculator)") {
    Open-OmegaApp "calculator"
    Write-Host "OMEGA: Calculadora abierta." -ForegroundColor Green
}
elseif ($orderText -match "abre.*(explorador|carpetas)") {
    Open-OmegaApp "explorer"
    Write-Host "OMEGA: Explorador abierto." -ForegroundColor Green
}
elseif ($orderText -match "^(omega[, ]+)?escribe\s+(.+)$") {
    $text = $Matches[2]

    if ($text.Length -gt 5000) {
        throw "Texto demasiado largo."
    }

    $writeScript = Join-Path $PSScriptRoot "write-text.ps1"

    if (-not (Test-Path $writeScript)) {
        throw "No se encuentra el motor de escritura."
    }

    Write-Host "OMEGA: selecciona la ventana donde escribir." -ForegroundColor Yellow

    & powershell.exe -NoProfile -STA -ExecutionPolicy Bypass `
        -File $writeScript -Text $text

    if ($LASTEXITCODE -ne 0) {
        throw "La escritura no se ha completado."
    }
}
else {
    Write-Host "OMEGA: orden no reconocida." -ForegroundColor Yellow
    Write-Host "Prueba: abre calculadora, abre bloc de notas o escribe..."
}