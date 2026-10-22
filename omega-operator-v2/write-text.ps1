param(
    [Parameter(Mandatory=$true)]
    [string]$Text
)

$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Windows.Forms

if ($Text.Length -gt 5000) {
    throw "Maximo 5000 caracteres por operacion."
}

Write-Host ""
Write-Host "OMEGA OPERADOR - ESCRITURA LOCAL" -ForegroundColor Cyan
Write-Host "Texto preparado: $($Text.Length) caracteres."
Write-Host "Selecciona la ventana donde quieres escribir."
Write-Host "Tienes 5 segundos para colocar el cursor." -ForegroundColor Yellow

Start-Sleep -Seconds 5

# SendKeys requiere escapar caracteres especiales.
# Se utiliza el portapapeles para preservar texto Unicode.
$previousClipboard = $null
$hadClipboardText = $false

try {
    if ([System.Windows.Forms.Clipboard]::ContainsText()) {
        $previousClipboard = [System.Windows.Forms.Clipboard]::GetText()
        $hadClipboardText = $true
    }

    [System.Windows.Forms.Clipboard]::SetText($Text)
    [System.Windows.Forms.SendKeys]::SendWait("^v")

    Start-Sleep -Milliseconds 500
}
finally {
    if ($hadClipboardText) {
        [System.Windows.Forms.Clipboard]::SetText($previousClipboard)
    }
}

Write-Host "OMEGA: orden de pegado enviada." -ForegroundColor Green
Write-Host "Comprueba visualmente que el texto aparezca correctamente."