$ErrorActionPreference = "Stop"
$Mozaik = "C:\Mozaik"
$Root = Join-Path $env:LOCALAPPDATA "OCRE\Polimob"
$RepoMozaik = Join-Path $Root "Mozaik"
$BackupRoot = Join-Path $env:LOCALAPPDATA "OCRE\PolimobBackups"
$Repo = "https://github.com/ocre-os/Polimob.git"
$Included = @(
  "Product Libraries","Insert Libraries","Data\ClosetRods","Data\CNC","Data\Doors",
  "Data\Fasteners","Data\Labels","Data\Legs","Data\Lights","Data\Locks","Data\Molding",
  "Data\MultiprintSymbolImages","Data\Pulls","Data\ReplacementRules","Data\ReportTemplates",
  "Data\StdConst","Data\TemplateImport"
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

# El clon es solo staging. Nunca hacemos stash/reset/clean sobre C:\Mozaik.
# Si una ejecucion anterior dejo el staging sucio, se reemplaza por un clon limpio.
$needsClone = !(Test-Path (Join-Path $Root ".git"))
if (!$needsClone) {
  Push-Location $Root
  $dirty = git status --porcelain
  Pop-Location
  if ($dirty) {
    Write-Host "Recuperando staging de una ejecucion anterior..."
    # No usamos Remove-Item: Git puede dejar directorios con atributos/bloqueos
    # que provocan preguntas interactivas. Renombramos el staging y clonamos limpio.
    $oldRoot = "$Root.old-$stamp"
    try {
      Rename-Item -LiteralPath $Root -NewName (Split-Path $oldRoot -Leaf) -ErrorAction Stop
    } catch {
      $Root = Join-Path $env:LOCALAPPDATA ("OCRE\\Polimob-" + $stamp)
      $RepoMozaik = Join-Path $Root "Mozaik"
    }
    $needsClone = $true
  }
}
if ($needsClone) {
  New-Item -ItemType Directory -Force -Path (Split-Path $Root) | Out-Null
  git clone $Repo $Root
  if ($LASTEXITCODE -ne 0) { throw "No se pudo clonar ocre-os/Polimob." }
} else {
  Push-Location $Root
  git pull --ff-only
  if ($LASTEXITCODE -ne 0) { Pop-Location; throw "No se pudo actualizar ocre-os/Polimob." }
  Pop-Location
}

# Primera fuente: la instalacion local de Mozaik. Copiamos al staging sin borrar
# archivos locales ni pedir confirmaciones interactivas.
Write-Host "Recopilando configuracion local..."
foreach ($rel in $Included) { Copy-Tree (Join-Path $Mozaik $rel) (Join-Path $RepoMozaik $rel) }

Push-Location $Root
git config user.name "OCRE Polimob Sync"
git config user.email "polimob-sync@ocre.mx"
git add -- "Mozaik"
$changes = git status --porcelain -- "Mozaik"
if ($changes) {
  $machine = $env:COMPUTERNAME
  git commit -m "sync(mozaik): $machine $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
  if ($LASTEXITCODE -ne 0) { Pop-Location; throw "No se pudo crear el commit." }
  git push
  if ($LASTEXITCODE -ne 0) { Pop-Location; throw "No se pudo publicar. Autoriza GitHub cuando Git Credential Manager lo solicite." }
  Write-Host "Configuracion publicada correctamente." -ForegroundColor Green
} else {
  Write-Host "Sin cambios locales por publicar." -ForegroundColor Green
}
Pop-Location

# Solo despues de publicar correctamente aplicamos la version consolidada.
Write-Host "Aplicando configuracion consolidada a Mozaik..."
foreach ($rel in $Included) { Copy-Tree (Join-Path $RepoMozaik $rel) (Join-Path $Mozaik $rel) }

Write-Host "Sincronizacion terminada." -ForegroundColor Green
