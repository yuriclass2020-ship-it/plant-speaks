$ErrorActionPreference = "Stop"

$appDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$frontUrl = "http://localhost:5175"
$serverUrl = "http://localhost:8787/api/health"
$logDir = Join-Path $appDir "logs"

New-Item -ItemType Directory -Force -Path $logDir | Out-Null
Set-Content -Path (Join-Path $logDir "launcher.log") -Value "launcher started $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"

function Stop-PortProcess($port) {
  try {
    $connections = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
    $processIds = $connections |
      Select-Object -ExpandProperty OwningProcess -Unique |
      Where-Object { $_ -and $_ -gt 0 }

    foreach ($processId in $processIds) {
      Add-Content -Path (Join-Path $logDir "launcher.log") -Value "stopping process on port $port pid $processId"
      Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
    }
  } catch {
    Add-Content -Path (Join-Path $logDir "launcher.log") -Value "could not stop port ${port}: $($_.Exception.Message)"
  }
}

function Test-UrlReady($url) {
  try {
    $response = Invoke-WebRequest -UseBasicParsing -Uri $url -TimeoutSec 2
    return $response.StatusCode -ge 200 -and $response.StatusCode -lt 500
  } catch {
    return $false
  }
}

function Start-HiddenAppProcess($name, $workingDirectory, $command) {
  $logPath = Join-Path $logDir "$name.log"
  $escapedWorkingDirectory = $workingDirectory.Replace("'", "''")
  $escapedLogPath = $logPath.Replace("'", "''")
  $processCommand = "Set-Location '$escapedWorkingDirectory'; $command *> '$escapedLogPath'"

  Start-Process `
    -FilePath "powershell.exe" `
    -WorkingDirectory $workingDirectory `
    -ArgumentList "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", $processCommand `
    -WindowStyle Hidden
}

function Open-PlantTalkAppWindow($url) {
  $profileDir = Join-Path $env:LocalAppData "PlantTalkBrowserProfile"
  New-Item -ItemType Directory -Force -Path $profileDir | Out-Null

  $browserCandidates = @(
    "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
    "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe",
    "$env:LocalAppData\Microsoft\Edge\Application\msedge.exe",
    "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
    "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
    "$env:LocalAppData\Google\Chrome\Application\chrome.exe"
  )

  foreach ($browserPath in $browserCandidates) {
    if ($browserPath -and (Test-Path $browserPath)) {
      Add-Content -Path (Join-Path $logDir "launcher.log") -Value "opening app window with $browserPath"
      Start-Process -FilePath $browserPath -ArgumentList @(
        "--new-window",
        "--app=$url",
        "--user-data-dir=$profileDir"
      )
      return
    }
  }

  Add-Content -Path (Join-Path $logDir "launcher.log") -Value "opening fallback browser $url"
  Start-Process $url
}

Stop-PortProcess 5175
Stop-PortProcess 8787

Start-Sleep -Milliseconds 500

Start-HiddenAppProcess "server" (Join-Path $appDir "server") "npm run dev"
Start-HiddenAppProcess "front" $appDir "npm run dev"

for ($i = 0; $i -lt 60; $i += 1) {
  $frontReady = Test-UrlReady $frontUrl
  $serverReady = Test-UrlReady $serverUrl

  if ($frontReady -and $serverReady) {
    $openUrl = "$frontUrl/?launch=$([DateTimeOffset]::Now.ToUnixTimeMilliseconds())"
    Open-PlantTalkAppWindow $openUrl
    exit 0
  }

  Start-Sleep -Seconds 1
}

Add-Type -AssemblyName PresentationFramework
[System.Windows.MessageBox]::Show(
  "Could not start 식물talk. Please check plant-speaks\logs\front.log and server.log.",
  "식물talk"
)
