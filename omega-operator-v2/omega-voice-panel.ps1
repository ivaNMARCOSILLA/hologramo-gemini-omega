Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName System.Speech

$form = New-Object System.Windows.Forms.Form
$form.Text = "OMEGA OPERADOR 2.0 - VOZ"
$form.Width = 650
$form.Height = 420
$form.StartPosition = "CenterScreen"

$box = New-Object System.Windows.Forms.TextBox
$box.Multiline = $true
$box.ScrollBars = "Vertical"
$box.SetBounds(20,20,590,240)
$form.Controls.Add($box)

$listen = New-Object System.Windows.Forms.Button
$listen.Text = "ESCUCHAR"
$listen.SetBounds(20,280,180,45)
$form.Controls.Add($listen)

$send = New-Object System.Windows.Forms.Button
$send.Text = "ENVIAR A BLOC DE NOTAS"
$send.SetBounds(220,280,260,45)
$form.Controls.Add($send)

$recognizer = $null

$listen.Add_Click({
    try {
        if ($null -ne $recognizer) {
            $recognizer.Dispose()
            $recognizer = $null
        }

        $recognizer = New-Object System.Speech.Recognition.SpeechRecognitionEngine

        $grammar = New-Object System.Speech.Recognition.DictationGrammar
        $recognizer.LoadGrammar($grammar)

        $recognizer.SetInputToDefaultAudioDevice()

        $box.Text = "Escuchando durante 8 segundos..."
        $form.Refresh()

        $result = $recognizer.Recognize(
            [TimeSpan]::FromSeconds(8)
        )

        if ($result) {
            $box.Text = $result.Text
        } else {
            $box.Text = "No se ha reconocido ninguna frase."
        }
    }
    catch {
        [System.Windows.Forms.MessageBox]::Show(
            $_.Exception.Message,
            "OMEGA - Error de voz"
        ) | Out-Null
    }
})

$send.Add_Click({
    if ([string]::IsNullOrWhiteSpace($box.Text)) {
        return
    }

    $text = $box.Text

    $notepad = Start-Process notepad.exe -PassThru

    Start-Sleep -Seconds 2

    try {
        $shell = New-Object -ComObject WScript.Shell
        if (-not $shell.AppActivate($notepad.Id)) {
            throw "No se pudo activar Bloc de notas."
        }

        Start-Sleep -Milliseconds 500

        [System.Windows.Forms.Clipboard]::SetText($text)
        [System.Windows.Forms.SendKeys]::SendWait("^v")

        [System.Windows.Forms.MessageBox]::Show(
            "Texto enviado a Bloc de notas.",
            "OMEGA"
        ) | Out-Null
    }
    catch {
        [System.Windows.Forms.MessageBox]::Show(
            $_.Exception.Message,
            "OMEGA - Error"
        ) | Out-Null
    }
})

[void]$form.ShowDialog()