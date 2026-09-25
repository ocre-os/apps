$ErrorActionPreference = "Stop"
$Mozaik = "C:\Mozaik"
$AppDir = Join-Path $env:ProgramData "OCRE\PolimobSync"
$ProfileFile = Join-Path $AppDir "profile.json"
$Root = Join-Path $env:LOCALAPPDATA "OCRE\Polimob"
$RepoMozaik = Join-Path $Root "Mozaik"
$BackupRoot = Join-Path $env:LOCALAPPDATA "OCRE\PolimobBackups"
$Repo = "https://github.com/ocre-os/Polimob.git"

$Groups = [ordered]@{
 "Postprocesadores y CNC" = @("Data\CNC")
 "Materiales y productos" = @("Product Libraries")
 "Bibliotecas de insertos" = @("Insert Libraries")
 "Etiquetas" = @("Data\Labels")
 "Plantillas de reporte" = @("Data\ReportTemplates")
 "Plantillas de importacion" = @("Data\TemplateImport")
 "Puertas" = @("Data\Doors")
 "Herrajes y accesorios" = @("Data\ClosetRods","Data\Fasteners","Data\Legs","Data\Lights","Data\Locks","Data\Molding","Data\Pulls")
 "Reglas y construccion" = @("Data\ReplacementRules","Data\StdConst")
 "Simbolos Multiprint" = @("Data\MultiprintSymbolImages")
}
$AllPaths = @($Groups.Values | ForEach-Object { $_ } | Select-Object -Unique)

function Copy-Tree([string]$Source,[string]$Destination) {
 if (!(Test-Path $Source)) { return }
 New-Item -ItemType Directory -Force -Path $Destination | Out-Null
 & robocopy $Source $Destination /E /R:2 /W:1 /NFL /NDL /NJH /NJS /NP | Out-Null
 if ($LASTEXITCODE -ge 8) { throw "Robocopy fallo ($LASTEXITCODE): $Source" }
}
function Test-MozaikOpen {
 $p = Get-Process -ErrorAction SilentlyContinue | Where-Object { $_.ProcessName -match 'mozaik' }
 return [bool]$p
}
function New-Profile {
 New-Item -ItemType Directory -Force -Path $AppDir | Out-Null
 Write-Host ""
 Write-Host "Configuracion inicial de esta computadora" -ForegroundColor Cyan
 Write-Host "Elige por categoria: 1=Solo recibir, 2=Solo publicar, 3=Publicar y recibir, 4=Local/no sincronizar"
 $modes=[ordered]@{}
 foreach($name in $Groups.Keys) {
   do { $v=Read-Host "$name [1/2/3/4]" } until($v -in @("1","2","3","4"))
   $modes[$name]=@{"1"="pull";"2"="push";"3"="both";"4"="local"}[$v]
 }
 $profile=[ordered]@{version=1;computer=$env:COMPUTERNAME;modes=$modes}
 $profile | ConvertTo-Json -Depth 6 | Set-Content -Encoding UTF8 $ProfileFile
 return [pscustomobject]$profile
}
function Get-Profile {
 if (!(Test-Path $ProfileFile)) { return New-Profile }
 return Get-Content -Raw $ProfileFile | ConvertFrom-Json
}

Write-Host ""
Write-Host "OCRE Polimob Sync" -ForegroundColor Cyan
Write-Host "Mozaik: $Mozaik"
if (!(Test-Path $Mozaik)) { throw "No existe C:\Mozaik." }
if (Test-MozaikOpen) {
 Write-Host ""
 Write-Host "Mozaik esta abierto." -ForegroundColor Yellow
 Write-Host "Cierra Mozaik antes de sincronizar. No se realizo ningun cambio."
 exit 2
}
if (!(Get-Command git -ErrorAction SilentlyContinue)) {
 if (Get-Command winget -ErrorAction SilentlyContinue) {
   Write-Host "Instalando Git for Windows..."
   winget install --id Git.Git -e --source winget --accept-package-agreements --accept-source-agreements
   $env:Path += ";C:\Program Files\Git\cmd"
 }
}
if (!(Get-Command git -ErrorAction SilentlyContinue)) { throw "Instala Git for Windows y vuelve a ejecutar." }

$profile=Get-Profile
$stamp=Get-Date -Format "yyyyMMdd-HHmmss"
$backup=Join-Path $BackupRoot $stamp
Write-Host "Perfil: $($profile.computer)"
Write-Host "Creando respaldo..."
foreach($rel in $AllPaths){ Copy-Tree (Join-Path $Mozaik $rel) (Join-Path $backup $rel) }

# El staging es descartable; nunca se borra ni resetea C:\Mozaik.
$needsClone=!(Test-Path (Join-Path $Root ".git"))
if(!$needsClone){
 Push-Location $Root
 $dirty=git status --porcelain
 Pop-Location
 if($dirty){
   $oldRoot="$Root.old-$stamp"
   try { Rename-Item -LiteralPath $Root -NewName (Split-Path $oldRoot -Leaf) -ErrorAction Stop }
   catch { $Root=Join-Path $env:LOCALAPPDATA ("OCRE\Polimob-"+$stamp); $RepoMozaik=Join-Path $Root "Mozaik" }
   $needsClone=$true
 }
}
if($needsClone){
 New-Item -ItemType Directory -Force -Path (Split-Path $Root) | Out-Null
 git clone $Repo $Root
 if($LASTEXITCODE -ne 0){ throw "No se pudo clonar ocre-os/Polimob." }
}else{
 Push-Location $Root
 git pull --ff-only
 if($LASTEXITCODE -ne 0){ Pop-Location; throw "No se pudo actualizar ocre-os/Polimob." }
 Pop-Location
}

$pushPaths=@()
$pullPaths=@()
foreach($name in $Groups.Keys){
 $mode=$profile.modes.$name
 foreach($rel in $Groups[$name]){
   if($mode -in @("push","both")){$pushPaths += $rel}
   if($mode -in @("pull","both")){$pullPaths += $rel}
 }
}
$pushPaths=@($pushPaths|Select-Object -Unique)
$pullPaths=@($pullPaths|Select-Object -Unique)

if($pushPaths.Count -gt 0){
 Write-Host "Recopilando categorias autorizadas para publicar..."
 foreach($rel in $pushPaths){ Copy-Tree (Join-Path $Mozaik $rel) (Join-Path $RepoMozaik $rel) }
 Push-Location $Root
 git config user.name "OCRE Polimob Sync"
 git config user.email "polimob-sync@ocre.mx"
 foreach($rel in $pushPaths){ git add -- ("Mozaik/"+($rel -replace '\\','/')) }
 $changes=git status --porcelain -- "Mozaik"
 if($changes){
   git commit -m "sync(mozaik): $env:COMPUTERNAME $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
   if($LASTEXITCODE -ne 0){ Pop-Location; throw "No se pudo crear el commit." }
   git push
   if($LASTEXITCODE -ne 0){ Pop-Location; throw "No se pudo publicar. Autoriza GitHub cuando se solicite." }
   Write-Host "Cambios autorizados publicados." -ForegroundColor Green
 }
 Pop-Location
}
if($pullPaths.Count -gt 0){
 Write-Host "Aplicando categorias autorizadas para recibir..."
 foreach($rel in $pullPaths){ Copy-Tree (Join-Path $RepoMozaik $rel) (Join-Path $Mozaik $rel) }
}
Write-Host "Sincronizacion terminada." -ForegroundColor Green
Write-Host "Perfil: $ProfileFile"
