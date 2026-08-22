# Enregistre une tache Windows qui demarre le bot a l'ouverture de session.
#
# Les collectes de 10 h et 17 h sont pilotees PAR LE BOT lui-meme : elles
# n'ont lieu que s'il tourne. Cette tache garantit qu'il tourne.
#
#   Installer    : powershell -ExecutionPolicy Bypass -File outils\installer-tache-planifiee.ps1
#   Desinstaller : Unregister-ScheduledTask -TaskName "Bot fournisseurs Akora" -Confirm:$false
#
# Fichier volontairement en ASCII pur : sans BOM, PowerShell 5.1 lit les tirets
# cadratins et les fleches comme des guillemets et casse le script.

$ErrorActionPreference = "Stop"
$racine = Split-Path -Parent $PSScriptRoot
$lanceur = Join-Path $racine "DEMARRER.bat"

if (-not (Test-Path $lanceur)) { throw "Introuvable : $lanceur" }

$action    = New-ScheduledTaskAction -Execute $lanceur -WorkingDirectory $racine
$demarrage = New-ScheduledTaskTrigger -AtLogOn
# Les reglages par defaut arretent une tache au bout de 3 jours et la coupent
# sur batterie : ni l'un ni l'autre ne convient a un bot qui doit rester la.
$options   = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries `
                -DontStopIfGoingOnBatteries -ExecutionTimeLimit ([TimeSpan]::Zero) `
                -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 5)

Register-ScheduledTask -TaskName "Bot fournisseurs Akora" -Action $action `
    -Trigger $demarrage -Settings $options -Description `
    "Demarre le bot de prospection des fournisseurs Akora (collectes 10h et 17h)." -Force | Out-Null

Write-Host "Tache enregistree. Le bot demarrera a chaque ouverture de session."
Write-Host "Pour le lancer maintenant : Start-ScheduledTask -TaskName 'Bot fournisseurs Akora'"
