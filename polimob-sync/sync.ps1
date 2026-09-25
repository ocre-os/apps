$ErrorActionPreference = "Stop"
$Mozaik = "C:\Mozaik"
$Root = Join-Path $env:LOCALAPPDATA "OCRE\Polimob"
$RepoMozaik = Join-Path $Root "Mozaik"
$BackupRoot = Join-Path $env:LOCALAPPDATA "OCRE\PolimobBackups"
$Repo = "https://github.com/ocre-os/Polimob.git"
$Included = @(
  "Product Libraries",
  "Insert Libraries",
  "Data\ClosetRods",
  "Data\CNC",
  "Data\Doors",
  "Data\Fasteners",
  "Data\Labels",
  "Data\Legs",
  "Data\Lights",
  "Data\Locks",
  "Data\Molding",
  "Data\MultiprintSymbolImages",
  "Data\Pulls",
  "Data\ReplacementRules",
  "Data\ReportTemplates",
  "Data\StdConst",
  "Data\TemplateImport"
)

function Copy-Tree([string]$Source,[string]$Destination) {
  if (!(Test-Path $Source)) { return }
  New-Item -ItemType Directory -Force -Path $Destination | Out-Null
  & robocopy $Source $Destination /E /R:2 /W:1 /NFL /NDL /NJH /NJS /NP | Out-Null
  if ($LASTEXITCODE -ge 8) { throw "Robocopy fallo ($LASTEXITCODE): $Source" }
}

Write-Host ""
Write-Host "OCRE Polimob Sync" -ForegroundColor Cyan
Write-Host "Mozaik: $Mozaik"
if (!(Test-Path $Mozaik)) { throw "No existe C:\Mozaik." }

if (!(Get-Command git -ErrorAction SilentlyContinue)) {
  Write-Host "Git for Windows no esta instalado." -ForegroundColor Yellow
  if (Get-Command winget -ErrorAction SilentlyContinue) {
    Write-Host "Instalando Git for Windows..."
    winget install --id Git.Git -e --source winget --accept-package-agreements --accept-source-agreements
    $env:Path += ";C:\Program Files\Git\cmd"
  }
}
if (!(Get-Command git -ErrorAction SilentlyContinue)) { throw "Instala Git for Windows y vuelve a ejecutar OCRE Polimob Sync." }

$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backup = Join-Path $BackupRoot $stamp
Write-Host "Creando respaldo de configuracion..."
foreach ($rel in $Included) { Copy-Tree (Join-Path $Mozaik $rel) (Join-Path $backup $rel) }

if (!(Test-Path (Join-Path $Root ".git"))) {
  New-Item -ItemType Directory -Force -Path (Split-Path $Root) | Out-Null
  git clone $Repo $Root
  if ($LASTEXITCODE -ne 0) { throw "No se pudo clonar ocre-os/Polimob." }
} else {
  Push-Location $Root
  # Una ejecucion anterior puede haber dejado cambios sin commit. Los preservamos
  # mientras actualizamos el remoto y los reaplicamos despues.
  $dirty = git status --porcelain
  $stashed = $false
  if ($dirty) {
    git stash push -u -m "OCRE Polimob Sync auto-stash" -- "Mozaik" | Out-Null
    if ($LASTEXITCODE -ne 0) { Pop-Location; throw "No se pudieron preservar los cambios locales antes de actualizar." }
    $stashed = $true
  }
  git pull --rebase
  if ($LASTEXITCODE -ne 0) { Pop-Location; throw "No se pudo actualizar ocre-os/Polimob." }
  if ($stashed) {
    git stash pop
    if ($LASTEXITCODE -ne 0) { Pop-Location; throw "Se detecto un conflicto al recuperar cambios locales. El respaldo de Mozaik permanece intacto." }
  }
  Pop-Location
}

Write-Host "Aplicando configuracion compartida a Mozaik..."
foreach ($rel in $Included) { Copy-Tree (Join-Path $RepoMozaik $rel) (Join-Path $Mozaik $rel) }

Write-Host "Recopilando cambios locales..."
foreach ($rel in $Included) { Copy-Tree (Join-Path $Mozaik $rel) (Join-Path $RepoMozaik $rel) }

Push-Location $Root
git add -- "Mozaik"
$changes = git status --porcelain -- "Mozaik"
if ($changes) {
  $machine = $env:COMPUTERNAME
  git commit -m "sync(mozaik): $machine $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
  if ($LASTEXITCODE -ne 0) { Pop-Location; throw "No se pudo crear el commit." }
  git push
  if ($LASTEXITCODE -ne 0) { Pop-Location; throw "No se pudo publicar. GitHub puede solicitar autenticacion." }
  Write-Host "Sincronizacion publicada correctamente." -ForegroundColor Green
} else {
  Write-Host "Sin cambios locales por publicar." -ForegroundColor Green
}
Pop-Location
Write-Host "Sincronizacion terminada." -ForegroundColor Green
