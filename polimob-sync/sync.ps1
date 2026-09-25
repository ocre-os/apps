$ErrorActionPreference = "Stop"
$Mozaik = "C:\Mozaik"
$AppDir = Join-Path $env:ProgramData "OCRE\PolimobSync"
$ProfileFile = Join-Path $AppDir "profile.json"
$Root = Join-Path $env:LOCALAPPDATA "OCRE\Polimob"
$RepoMozaik = Join-Path $Root "Mozaik"
$BackupRoot = Join-Path $env:LOCALAPPDATA "OCRE\PolimobBackups"
$Repo = "https://github.com/ocre-os/Polimob.git"

$BasePaths = @(
 "Product Libraries","Insert Libraries","Data\\ClosetRods","Data\\Doors","Data\\Fasteners",
 "Data\\Labels","Data\\Legs","Data\\Lights","Data\\Locks","Data\\Molding",
 "Data\\MultiprintSymbolImages","Data\\Pulls","Data\\ReplacementRules",
 "Data\\ReportTemplates","Data\\StdConst","Data\\TemplateImport"
)
function Get-SyncTargets {
 $targets = New-Object System.Collections.Generic.List[string]
 foreach($p in $BasePaths){ if(Test-Path (Join-Path $Mozaik $p)){ $targets.Add($p) } }
 $cnc = Join-Path $Mozaik "Data\\CNC"
 if(Test-Path $cnc){
   # Los archivos directamente dentro de Data\\CNC se administran como un objetivo propio.
   if(Get-ChildItem -LiteralPath $cnc -File -ErrorAction SilentlyContinue){ $targets.Add("Data\\CNC\\[archivos raiz]") }
   Get-ChildItem -LiteralPath $cnc -Directory -ErrorAction SilentlyContinue | Sort-Object Name | ForEach-Object {
     $targets.Add("Data\\CNC\\" + $_.Name)
   }
 }
 return @($targets | Sort-Object -Unique)
}
$AllPaths = Get-SyncTargets

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
 Write-Host "Configura cada carpeta real: 1=Solo recibir, 2=Solo publicar, 3=Publicar y recibir, 4=Local/no sincronizar"
 $modes=[ordered]@{}
 foreach($path in $AllPaths) {
   do { $v=Read-Host "$path [1/2/3/4]" } until($v -in @("1","2","3","4"))
   $modes[$path]=@{"1"="pull";"2"="push";"3"="both";"4"="local"}[$v]
 }
 $profile=[ordered]@{version=2;computer=$env:COMPUTERNAME;modes=$modes}
 $profile | ConvertTo-Json -Depth 8 | Set-Content -Encoding UTF8 $ProfileFile
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

if(Test-Path $ProfileFile){
 try { $existing=Get-Content -Raw $ProfileFile | ConvertFrom-Json } catch { $existing=$null }
 if(!$existing -or $existing.version -lt 2){
   Write-Host "El perfil anterior sera reemplazado por seleccion de carpetas reales." -ForegroundColor Yellow
   Remove-Item -LiteralPath $ProfileFile -Force -ErrorAction SilentlyContinue
 }
}
$profile=Get-Profile
$stamp=Get-Date -Format "yyyyMMdd-HHmmss"
$backup=Join-Path $BackupRoot $stamp
Write-Host "Perfil: $($profile.computer)"
Write-Host "Creando respaldo..."
foreach($rel in $AllPaths){
 if($rel -eq "Data\\CNC\\[archivos raiz]"){
   $src=Join-Path $Mozaik "Data\\CNC"; $dst=Join-Path $backup "Data\\CNC"
   New-Item -ItemType Directory -Force -Path $dst | Out-Null
   Get-ChildItem -LiteralPath $src -File -ErrorAction SilentlyContinue | Copy-Item -Destination $dst -Force
 } else { Copy-Tree (Join-Path $Mozaik $rel) (Join-Path $backup $rel) }
}

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
foreach($rel in $AllPaths){
 $mode=$profile.modes.$rel
 if($mode -in @("push","both")){$pushPaths += $rel}
 if($mode -in @("pull","both")){$pullPaths += $rel}
}
if($pushPaths.Count -gt 0){
 Write-Host "Recopilando categorias autorizadas para publicar..."
 foreach($rel in $pushPaths){
 if($rel -eq "Data\\CNC\\[archivos raiz]"){
   $src=Join-Path $Mozaik "Data\\CNC"; $dst=Join-Path $RepoMozaik "Data\\CNC"
   New-Item -ItemType Directory -Force -Path $dst | Out-Null
   Get-ChildItem -LiteralPath $src -File -ErrorAction SilentlyContinue | Copy-Item -Destination $dst -Force
 } else { Copy-Tree (Join-Path $Mozaik $rel) (Join-Path $RepoMozaik $rel) }
}
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
 foreach($rel in $pullPaths){
 if($rel -eq "Data\\CNC\\[archivos raiz]"){
   $src=Join-Path $RepoMozaik "Data\\CNC"; $dst=Join-Path $Mozaik "Data\\CNC"
   New-Item -ItemType Directory -Force -Path $dst | Out-Null
   Get-ChildItem -LiteralPath $src -File -ErrorAction SilentlyContinue | Copy-Item -Destination $dst -Force
 } else { Copy-Tree (Join-Path $RepoMozaik $rel) (Join-Path $Mozaik $rel) }
}
}
Write-Host "Sincronizacion terminada." -ForegroundColor Green
Write-Host "Perfil: $ProfileFile"
