$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName System.Speech

$commandScript = Join-Path $PSScriptRoot "omega-command.ps1"

$form = New-Object System.Windows.Forms.Form
$form.Text = "OMEGA 2.0 - CONTROL POR VOZ"
$form.Width = 660
$form.Height = 390
$form.StartPosition = "CenterScreen"

$info = New-Object System.Windows.Forms.Label
$info.Text = "Pulsa ESCUCHAR y di: OMEGA abre calculadora"
$info.SetBounds(20,15,600,35)
$form.Controls.Add($info)

$box = New-Object System.Windows.Forms.TextBox
$box.Multiline = $true
$box.ScrollBars = "Vertical"
$box.SetBounds(20,60,600,170)
$form.Controls.Add($box)

$listen = New-Object System.Windows.Forms.Button
$listen.Text = "ESCUCHAR"
$listen.SetBounds(20,250,180,45)
$form.Controls.Add($listen)

$execute = New-Object System.Windows.Forms.Button
$execute.Text = "EJECUTAR ORDEN"
$execute.SetBounds(220,250,190,45)
$form.Controls.Add($execute)

$status = New-Object System.Windows.Forms.Label
$status.Text = "Esperando orden..."
$status.SetBounds(20,310,600,25)
$form.Controls.Add($status)

$listen.Add_Click({
    $recognizer = $null

    try {
        $listen.Enabled = $false
        $status.Text = "Escuchando..."
        $form.Refresh()

        $recognizer = New-Object System.Speech.Recognition.SpeechRecognitionEngine
        $grammar = New-Object System.Speech.Recognition.DictationGrammar

        $recognizer.LoadGrammar($grammar)
        $recognizer.SetInputToDefaultAudioDevice()

        $result = $recognizer.Recognize(
            [TimeSpan]::FromSeconds(8)
        )

        if ($result -and $result.Confidence -ge 0.55) {
            $box.Text = $result.Text
            $status.Text = "Orden reconocida. Revisa antes de ejecutar."
        }
        else {
            $box.Text = ""
            $status.Text = "No se reconocio una orden con suficiente confianza."
        }
    }
    catch {
        $status.Text = "Error de reconocimiento."
        [System.Windows.Forms.MessageBox]::Show(
            $_.Exception.Message,
            "OMEGA - Voz"
        ) | Out-Null
    }
    finally {
        if ($recognizer) {
            $recognizer.Dispose()
        }
        $listen.Enabled = $true
    }
})

$execute.Add_Click({
    $order = $box.Text.Trim()

    if ([string]::IsNullOrWhiteSpace($order)) {
        return
    }

    if ($order.Length -gt 500) {
        $status.Text = "Orden demasiado larga."
        return
    }

    if ($order -notmatch '^(omega[\s,]+)?abre\s+(calculadora|calculator|bloc de notas|notepad|explorador|carpetas)\s*[.!]?$') {
        $status.Text = "Orden no autorizada para ejecucion por voz."
        return
    }

    $status.Text = "Ejecutando orden autorizada..."
    $form.Refresh()

    try {
        $output = & powershell.exe -NoProfile -STA `
            -File $commandScript -Order $order 2>&1

        if ($LASTEXITCODE -ne 0) {
            throw ($output | Out-String)
        }

        $status.Text = "Orden ejecutada."
        $box.Text = ($output | Out-String)
    }
    catch {
        $status.Text = "Error al ejecutar."
        [System.Windows.Forms.MessageBox]::Show(
            $_.Exception.Message,
            "OMEGA - Error"
        ) | Out-Null
    }
})

[void]$form.ShowDialog()