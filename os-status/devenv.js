(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports) module.exports=api;
 else root.OcreDevenv=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 // OCRE-058 F3: medidor de carga por agente. Solo números y estados fijos validados; nada más del payload se conserva.
 const QUOTA_STATES=new Set(['available','low','exhausted','unknown']);
 const MAX_AGE_MS=30000;
 const EVENT_KINDS=new Set(['deploy_ok','deploy_failed','monitor_stale','monitor_recovered']);
 const REF=/^[0-9a-f]{7,40}$/;
 const MAX_EVENTS=5;
 const BACKUP_KINDS=new Set(['daily','pre_release']);
 const BACKUP_MAX_HOURS=26; // OCRE-059: el respaldo de producción es diario (02:30); un día fallido ya avisa
 function int(value,min,max){return Number.isSafeInteger(value)&&value>=min&&value<=max?value:null;}
 function normalizeAgent(raw,capacity){
  const slots=int(raw?.slots_used,0,capacity);
  if(slots===null)return null;
  const quota=raw.quota||{};
  const state=QUOTA_STATES.has(quota.state)?quota.state:'unknown';
  const percent=int(quota.remaining_percent,0,100);
  const resets=Number.isFinite(Date.parse(quota.resets_at))?quota.resets_at:null;
  const turn=raw.turn_seconds===null||raw.turn_seconds===undefined?null:int(raw.turn_seconds,0,7*86400);
  return {slotsUsed:slots,capacity,turnSeconds:turn,quota:{state,remainingPercent:percent,resetsAt:resets}};
 }
 // Actividad reciente (F4): solo tipo fijo, hora válida y revisión hexadecimal; cualquier otra cosa se descarta.
 function normalizeEvents(raw){
  if(!Array.isArray(raw))return [];
  const out=[];
  for(const item of raw){
   const at=Date.parse(item?.at);
   if(!EVENT_KINDS.has(item?.kind)||!Number.isFinite(at))continue;
   const ref=typeof item.ref==='string'&&REF.test(item.ref)?item.ref:null;
   out.push({at:item.at,kind:item.kind,ref});
  }
  return out.sort((a,b)=>Date.parse(b.at)-Date.parse(a.at)).slice(0,MAX_EVENTS);
 }
 // Respaldos (OCRE-059): solo hora válida, tipo fijo y booleano; cualquier otra cosa se descarta.
 function normalizeBackup(raw){
  if(!raw||!BACKUP_KINDS.has(raw.kind)||typeof raw.ok!=='boolean'||!Number.isFinite(Date.parse(raw.at)))return null;
  return {at:raw.at,kind:raw.kind,ok:raw.ok};
 }
 function normalizeBackups(raw){return {core:normalizeBackup(raw?.core),staging:normalizeBackup(raw?.staging)};}
 function normalize(payload={},now=Date.now()){
  const empty={valid:false,observedAt:null,agents:{},events:[],backups:{core:null,staging:null}};
  const time=Date.parse(payload?.observed_at);
  if(payload?.contract!=='ocre-devenv-v1'||!Number.isFinite(time)||now-time>MAX_AGE_MS||now-time< -5000)return empty;
  const capacity=int(payload.capacity,1,8)??2;
  const agents={};
  for(const name of ['claude','codex']){
   const agent=normalizeAgent(payload.agents?.[name],capacity);
   if(agent)agents[name]=agent;
  }
  return Object.keys(agents).length?{valid:true,observedAt:payload.observed_at,agents,events:normalizeEvents(payload.events),backups:normalizeBackups(payload.backups)}:empty;
 }
 // Arco de medio círculo (izquierda → derecha) para una fracción 0..1 y la posición de la aguja.
 function geometry(used,capacity){
  const f=Math.max(0,Math.min(1,capacity>0?used/capacity:0));
  const cx=80,cy=78,r=60,nr=50;
  const point=(x,radius)=>{const a=Math.PI-Math.PI*x;return [cx+radius*Math.cos(a),cy-radius*Math.sin(a)];};
  const fix=(n)=>Number(n.toFixed(2));
  const [sx,sy]=point(0,r),[ex,ey]=point(1,r),[fx,fy]=point(f,r),[nx,ny]=point(f,nr);
  return {fraction:f,track:`M ${fix(sx)} ${fix(sy)} A ${r} ${r} 0 0 1 ${fix(ex)} ${fix(ey)}`,
   arc:f===0?'':`M ${fix(sx)} ${fix(sy)} A ${r} ${r} 0 0 1 ${fix(fx)} ${fix(fy)}`,needle:[fix(nx),fix(ny)]};
 }
 function loadTone(used,capacity){const f=capacity>0?used/capacity:0;return f>=1?'failed':f>0.5?'degraded':'healthy';}
 function loadLabel(used,capacity){return used===0?'libre':used>=capacity?'carga completa':'carga media';}
 function duration(seconds){
  if(seconds===null||seconds===undefined)return 'Sin turno';
  if(seconds<60)return seconds+' s';
  const minutes=Math.floor(seconds/60);
  if(minutes<60)return minutes+' min';
  const hours=Math.floor(minutes/60),rest=minutes%60;
  return hours+' h '+String(rest).padStart(2,'0')+' min';
 }
 function clock(iso){return new Intl.DateTimeFormat('es-MX',{hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(iso));}
 function quotaText(quota){
  const pct=quota.remainingPercent===null?'':' · '+quota.remainingPercent+' %';
  if(quota.state==='available')return {text:'Disponible'+pct,tone:'healthy'};
  if(quota.state==='low')return {text:'Baja'+pct,tone:'degraded'};
  if(quota.state==='exhausted')return {text:'Agotada'+(quota.resetsAt?' · vuelve '+clock(quota.resetsAt):''),tone:'failed'};
  return {text:'Sin dato',tone:'neutral'};
 }
 const NAMES={claude:'Claude',codex:'Codex'};
 const EVENT_TEXT={deploy_ok:['Despliegue de staging','healthy'],deploy_failed:['Despliegue de staging falló','failed'],
  monitor_stale:['Monitor detenido','stale'],monitor_recovered:['Monitor recuperado','healthy']};
 function ago(iso,now=Date.now()){
  const seconds=Math.max(0,Math.floor((now-Date.parse(iso))/1000));
  if(seconds<60)return 'hace un momento';
  const minutes=Math.floor(seconds/60);
  if(minutes<60)return 'hace '+minutes+' min';
  const hours=Math.floor(minutes/60);
  if(hours<24)return 'hace '+hours+' h';
  return 'hace '+Math.floor(hours/24)+' d';
 }
 function eventView(event,now=Date.now()){
  const [label,tone]=EVENT_TEXT[event.kind];
  return {label:label+(event.ref?' · '+event.ref.slice(0,7):''),tone,when:ago(event.at,now)};
 }
 // Lo que pide atención: carga completa y cuota agotada. Cuota baja solo se muestra, no alarma.
 function issues(devenv){
  const items=[];
  if(!devenv?.valid)return items;
  for(const [key,agent] of Object.entries(devenv.agents)){
   if(agent.quota.state==='exhausted')items.push({agent:key,name:NAMES[key]+' sin cuota',short:NAMES[key]+' sin cuota',
     text:agent.quota.resetsAt?'Vuelve a las '+clock(agent.quota.resetsAt)+'.':'Sin hora de regreso informada.'});
   if(agent.slotsUsed>=agent.capacity)items.push({agent:key,name:NAMES[key]+' con carga completa',short:NAMES[key]+' carga completa',
     text:agent.slotsUsed+' de '+agent.capacity+' tareas'+(agent.turnSeconds!==null?'; el turno lleva '+duration(agent.turnSeconds)+'.':'.')});
  }
  return items;
 }
 const BACKUP_ENV={core:'Producción',staging:'Staging'};
 const BACKUP_KIND_TEXT={daily:'diario',pre_release:'previo a despliegue'};
 function backupAgeHours(backup,now){return Math.max(0,(now-Date.parse(backup.at))/3600000);}
 // Estado de un respaldo. Producción también avisa por antigüedad; staging no tiene respaldo programado (solo volcados previos a despliegue).
 function backupView(backup,env,now=Date.now()){
  if(!backup)return {tone:'neutral',label:'Sin señal',text:'Sin dato del último respaldo.'};
  const kind=BACKUP_KIND_TEXT[backup.kind],when=ago(backup.at,now);
  if(!backup.ok)return {tone:'failed',label:'Falló',text:'El último respaldo ('+kind+') no se completó · '+when+'.'};
  if(env==='core'&&backupAgeHours(backup,now)>BACKUP_MAX_HOURS)return {tone:'degraded',label:'Desactualizado',text:'Último respaldo '+kind+' '+when+' (más de '+BACKUP_MAX_HOURS+' h).'};
  return {tone:'healthy',label:'Al día',text:'Último respaldo '+kind+' '+when+'.'};
 }
 function backupIssues(devenv,now=Date.now()){
  const items=[];
  if(!devenv?.valid)return items;
  for(const env of ['core','staging']){
   const view=backupView(devenv.backups?.[env],env,now);
   if(view.tone==='failed'||view.tone==='degraded')items.push({name:'Respaldo de '+BACKUP_ENV[env].toLowerCase()+(view.tone==='failed'?' falló':' desactualizado'),
    short:'Respaldo de '+BACKUP_ENV[env].toLowerCase(),text:view.text});
  }
  return items;
 }
 class DevenvMonitor{
  constructor({fetcher=(...args)=>fetch(...args),timeoutMs=5000}={}){this.fetcher=fetcher;this.timeoutMs=timeoutMs;this.cycle=0;this.controller=null;this.latest=normalize();}
  async check(url){
   const cycle=++this.cycle;
   this.controller?.abort();const controller=new AbortController();this.controller=controller;
   const timer=setTimeout(()=>controller.abort(),this.timeoutMs);
   let state;
   try{const response=await this.fetcher(url,{signal:controller.signal,cache:'no-store'});state=response.ok?normalize(await response.json()):normalize();}
   catch{state=normalize();}finally{clearTimeout(timer);}
   if(cycle===this.cycle)this.latest=state;
   return state;
  }
 }
 return {normalize,normalizeEvents,normalizeBackups,backupView,backupIssues,BACKUP_ENV,BACKUP_MAX_HOURS,eventView,ago,geometry,loadTone,loadLabel,duration,quotaText,issues,DevenvMonitor,NAMES};
});
