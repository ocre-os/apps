$ErrorActionPreference="Stop"
$Version="0.6.5"
$Mozaik="C:\Mozaik"
$AppDir=Join-Path $env:ProgramData "OCRE\PolimobSync"
$Profile=Join-Path $AppDir "profile.json"
if(!(Test-Path $Mozaik)){Add-Type -AssemblyName PresentationFramework;[System.Windows.MessageBox]::Show("No se encontro C:\Mozaik.","OCRE Polimob Sync")|Out-Null;exit 1}
New-Item -ItemType Directory -Force -Path $AppDir|Out-Null

$base=@("Product Libraries","Insert Libraries","Data\ClosetRods","Data\Doors","Data\Fasteners","Data\Labels","Data\Legs","Data\Lights","Data\Locks","Data\Molding","Data\MultiprintSymbolImages","Data\Pulls","Data\ReplacementRules","Data\ReportTemplates","Data\StdConst","Data\TemplateImport")
$paths=New-Object System.Collections.Generic.List[string]
foreach($p in $base){if(Test-Path (Join-Path $Mozaik $p)){$paths.Add($p)}}
$cnc=Join-Path $Mozaik "Data\CNC"
if(Test-Path $cnc){
 if(Get-ChildItem $cnc -File -ErrorAction SilentlyContinue){$paths.Add("Data\CNC\[archivos raiz]")}
 Get-ChildItem $cnc -Directory -ErrorAction SilentlyContinue|Sort-Object Name|ForEach-Object{$paths.Add("Data\CNC\"+$_.Name)}
}
$existing=@{}
if(Test-Path $Profile){try{$o=Get-Content -Raw $Profile|ConvertFrom-Json;foreach($p in $o.modes.PSObject.Properties){$existing[$p.Name]=$p.Value}}catch{}}
$rows=""
foreach($p in ($paths|Sort-Object -Unique)){
 $mode=if($existing.ContainsKey($p)){$existing[$p]}else{"local"}
 $push=if($mode -in @("push","both")){"checked"}else{""}
 $pull=if($mode -in @("pull","both")){"checked"}else{""}
 $del=if($mode -match "delete"){"checked"}else{""}
 $safe=[System.Net.WebUtility]::HtmlEncode($p)
 if($p -eq "Data\CNC\[archivos raiz]"){$count=@(Get-ChildItem (Join-Path $Mozaik "Data\CNC") -File -ErrorAction SilentlyContinue).Count}
 else{$count=@(Get-ChildItem (Join-Path $Mozaik $p) -File -Recurse -ErrorAction SilentlyContinue).Count}
 $rows+="<tr><td><code>$safe</code></td><td>$count</td><td><input type=checkbox class=push $push></td><td><input type=checkbox class=pull $pull></td><td><input type=checkbox class=del $del></td></tr>"
}
$token=[guid]::NewGuid().ToString("N")
$html=@"
<!doctype html><meta charset=utf-8><title>OCRE Polimob Sync</title>
<style>body{font:15px system-ui;background:#f4f6f8;color:#202124;margin:0}.w{max-width:1000px;margin:35px auto;padding:0 20px}.c{background:white;border:1px solid #ddd;border-radius:14px;padding:22px}h1{margin:0}.m{color:#68707c}table{width:100%;border-collapse:collapse;margin-top:18px}td,th{padding:10px;border-bottom:1px solid #eee;text-align:left}th:not(:first-child),td:not(:first-child){text-align:center}input[type=checkbox]{width:20px;height:20px}.b{display:flex;gap:10px;justify-content:flex-end;margin-top:18px}button{padding:11px 15px;border:0;border-radius:8px;font-weight:700;cursor:pointer}.p{background:#202124;color:white}.s{background:#eceff2}.n{background:#f7f8fa;padding:10px;border-radius:8px;margin-top:14px}</style>
<div class=w><div class=c><h1>OCRE Polimob Sync <span class=m>v$Version</span></h1><p class=m>Equipo: $env:COMPUTERNAME</p><div class=n>Publicar: esta PC &gt; Polimob. Recibir: Polimob &gt; esta PC. Eliminaciones desactivadas por defecto.</div>
<table><thead><tr><th>Carpeta detectada</th><th>Archivos</th><th>Publicar</th><th>Recibir</th><th>Propagar eliminaciones</th></tr></thead><tbody>$rows</tbody></table>
<div class=b><button class=s onclick="allPull()">Todo solo recibir</button><button class=s onclick="allLocal()">Todo local</button><button class=p onclick="save()">Guardar configuracion</button></div></div></div>
<script>
const TOKEN="$token";
function allPull(){document.querySelectorAll('.push,.del').forEach(x=>x.checked=false);document.querySelectorAll('.pull').forEach(x=>x.checked=true)}
function allLocal(){document.querySelectorAll('input[type=checkbox]').forEach(x=>x.checked=false)}
function save(){let modes={};document.querySelectorAll('tbody tr').forEach(r=>{let p=r.cells[0].innerText,pu=r.querySelector('.push').checked,pl=r.querySelector('.pull').checked,de=r.querySelector('.del').checked;modes[p]=(pu&&pl?'both':pu?'push':pl?'pull':'local')+(de?'+delete':'')});let payload=JSON.stringify({version:4,appVersion:"$Version",computer:"$env:COMPUTERNAME",modes});let q=encodeURIComponent(payload);location.href="http://127.0.0.1:48731/save?token="+TOKEN+"&profile="+q}
</script>
"@
$tmp=Join-Path $env:TEMP "ocre-polimob-config.html";Set-Content -Encoding UTF8 $tmp $html
$listener=New-Object System.Net.HttpListener;$listener.Prefixes.Add("http://127.0.0.1:48731/");$listener.Start()
Start-Process $tmp
try{
 $ctx=$listener.GetContext()
 if($ctx.Request.QueryString["token"] -ne $token){throw "Solicitud invalida"}
 $json=$ctx.Request.QueryString["profile"]
 if([string]::IsNullOrWhiteSpace($json)){throw "Perfil vacio"}
 $obj=$json|ConvertFrom-Json
 $obj|ConvertTo-Json -Depth 10|Set-Content -Encoding UTF8 $Profile
 $msg=[Text.Encoding]::UTF8.GetBytes("<html><meta charset=utf-8><body style='font:18px system-ui;padding:40px'><h2>Configuracion guardada</h2><p>Ya puedes cerrar esta ventana y ejecutar OCRE Polimob Sync.</p></body></html>")
 $ctx.Response.ContentType="text/html; charset=utf-8";$ctx.Response.OutputStream.Write($msg,0,$msg.Length);$ctx.Response.Close()
}finally{$listener.Stop();Remove-Item $tmp -Force -ErrorAction SilentlyContinue}
