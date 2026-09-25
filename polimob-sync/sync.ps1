$SyncVersion = "0.6.4"
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
 Write-Host "Falta configurar las carpetas de esta computadora." -ForegroundColor Yellow
 Write-Host "Ejecuta el acceso directo Configurar OCRE Polimob Sync y guarda el perfil."
 throw "Perfil de sincronizacion no configurado."
}
function Get-Profile {
 if (!(Test-Path $ProfileFile)) { return New-Profile }
 return Get-Content -Raw $ProfileFile | ConvertFrom-Json
}

Write-Host ""
Write-Host "OCRE Polimob Sync v$SyncVersion" -ForegroundColor Cyan
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
 if(!$existing -or $existing.version -lt 4){
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
 $prop=@($profile.modes.PSObject.Properties | Where-Object { $_.Name -eq $rel }) | Select-Object -First 1
 $mode=if($null -ne $prop){[string]$prop.Value}else{"local"}
 $baseMode=($mode -split '\+')[0]
 if($baseMode -in @("push","both")){$pushPaths += $rel}
 if($baseMode -in @("pull","both")){$pullPaths += $rel}
}
Write-Host "Publicar: $($pushPaths.Count) carpeta(s)"
Write-Host "Recibir: $($pullPaths.Count) carpeta(s)"
if(($pushPaths.Count + $pullPaths.Count) -eq 0){
 Write-Host "El perfil no tiene carpetas habilitadas para sincronizar." -ForegroundColor Yellow
 Write-Host "Abre Configurar OCRE Polimob Sync y revisa Publicar/Recibir."
 exit 3
}
# Previsualizacion segura antes de modificar Mozaik o publicar.
function Get-Preview([string]$rel,[string]$direction){
 $localBase=if($rel -eq "Data\\CNC\\[archivos raiz]"){Join-Path $Mozaik "Data\\CNC"}else{Join-Path $Mozaik $rel}
 $repoBase=if($rel -eq "Data\\CNC\\[archivos raiz]"){Join-Path $RepoMozaik "Data\\CNC"}else{Join-Path $RepoMozaik $rel}
 $source=if($direction -eq "pull"){$repoBase}else{$localBase}
 $dest=if($direction -eq "pull"){$localBase}else{$repoBase}
 if(!(Test-Path $source)){ return [pscustomobject]@{New=0;Update=0;MissingSource=$true} }
 $files=if($rel -eq "Data\\CNC\\[archivos raiz]"){Get-ChildItem $source -File -ErrorAction SilentlyContinue}else{Get-ChildItem $source -File -Recurse -ErrorAction SilentlyContinue}
 $new=0;$update=0
 foreach($x in $files){
   $rp=$x.FullName.Substring($source.Length).TrimStart('\\')
   $d=Join-Path $dest $rp
   if(!(Test-Path $d)){$new++}
   elseif($x.Length -ne (Get-Item $d).Length -or $x.LastWriteTimeUtc -gt (Get-Item $d).LastWriteTimeUtc){$update++}
 }
 [pscustomobject]@{New=$new;Update=$update;MissingSource=$false}
}
Write-Host ""
Write-Host "PREVISUALIZACION - aun no se ha modificado C:\Mozaik" -ForegroundColor Cyan
$hasWork=$false
foreach($rel in $pullPaths){
 $p=Get-Preview $rel "pull"
 if($p.MissingSource){Write-Host "[RECIBIR] $rel - NO EXISTE EN POLIMOB; se omitira" -ForegroundColor Yellow}
 else{Write-Host "[RECIBIR] $rel : $($p.New) nuevos, $($p.Update) por actualizar, 0 eliminaciones";if($p.New+$p.Update -gt 0){$hasWork=$true}}
}
foreach($rel in $pushPaths){
 $p=Get-Preview $rel "push"
 if($p.MissingSource){Write-Host "[PUBLICAR] $rel : no existe localmente; se omitira" -ForegroundColor Yellow}
 else{Write-Host "[PUBLICAR] $rel : $($p.New) nuevos, $($p.Update) por actualizar, 0 eliminaciones";if($p.New+$p.Update -gt 0){$hasWork=$true}}
}
if(!$hasWork){Write-Host "No hay cambios aplicables." -ForegroundColor Green; exit 0}
$confirm=Read-Host "Escribe SI para aplicar estos cambios"
if($confirm.Trim().ToUpperInvariant() -ne "SI"){Write-Host "Cancelado. No se modifico Mozaik.";exit 0}

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
