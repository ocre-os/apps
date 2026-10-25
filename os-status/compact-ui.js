(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.OcreCompact=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 const NAMES={claude:'Claude',codex:'Codex'};
 const clean=(v)=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function occupancy(agent){
  if(!agent||!Number.isInteger(agent.slotsUsed)||!Number.isInteger(agent.capacity)||agent.capacity<1||agent.slotsUsed<0||agent.slotsUsed>agent.capacity)
   return {text:'Sin señal',segments:'',valid:false};
  // Never represent 3/8 as fully occupied: omit segments above three slots.
  const marks=agent.capacity<=3?Array.from({length:agent.capacity},(_,i)=>'<i class="'+(i<agent.slotsUsed?'filled':'')+'"></i>').join(''):'';
  return {text:agent.slotsUsed+'/'+agent.capacity,segments:marks,valid:true};
 }
 function quota(q){
  if(!q||!['available','low','exhausted'].includes(q.state)||typeof q.remainingPercent!=='number'||!Number.isFinite(q.remainingPercent)||q.remainingPercent<0||q.remainingPercent>100||(q.state==='exhausted'&&q.remainingPercent!==0)||(q.resetsAt&&Number.isFinite(Date.parse(q.resetsAt))&&Date.parse(q.resetsAt)<=Date.now()))
   return {text:'Sin medición',tone:'unknown',percent:null};
  const percent=Math.round(Math.max(0,Math.min(100,q.remainingPercent)));
  return {text:percent+'% restante',tone:q.state,percent};
 }
 function currentTelemetry(state,now=Date.now()){
  const observed=Date.parse(state?.observedAt);
  return state?.valid===true&&Number.isFinite(observed)&&now-observed>=-5000&&now-observed<=30000;
 }
 function liveStates(info){
  const allowed=new Set(['working','waiting','available','unknown']);
  const states=info&&!info.stale&&info.state&&info.state.states;
  return Object.fromEntries(['claude','codex'].map(name=>[name,
   states&&allowed.has(states[name])?states[name]:'unknown']));
 }
 function freshExecution(states,observedAt,now=Date.now()){
  if(!Number.isFinite(observedAt)||observedAt<=0||now-observedAt< -5000||now-observedAt>30000)
   return {claude:'unknown',codex:'unknown'};
  const allowed=new Set(['working','waiting','available','unknown']);
  return Object.fromEntries(['claude','codex'].map(name=>[name,allowed.has(states?.[name])?states[name]:'unknown']));
 }
 function resetLabel(iso,now=Date.now()){
  const at=Date.parse(iso);
  if(!Number.isFinite(at)||at<=now)return 'Sin reinicio confirmado';
  return 'Reinicia '+new Intl.DateTimeFormat('es-MX',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}).format(new Date(at));
 }
 function turnLabel(seconds){
  if(!Number.isFinite(seconds)||seconds<0)return 'Sin señal';
  seconds=Math.floor(seconds);
  if(seconds===0)return 'Sin turno';
  if(seconds<60)return seconds+' s';
  if(seconds<3600)return Math.floor(seconds/60)+' min';
  return Math.floor(seconds/3600)+' h '+String(Math.floor(seconds%3600/60)).padStart(2,'0')+' min';
 }
 function runtimeDetails(name,runtimes={}){
  const ids=name==='claude'?['claude_wsl','claude_windows']:['codex_wsl'];
  const labels={claude_wsl:'Claude WSL',claude_windows:'Claude Windows',codex_wsl:'Codex WSL'};
  const states={authenticated:'Autenticado',unauthenticated:'Requiere iniciar sesión',unknown:'Sin dato',unavailable:'No disponible'};
  const quotas={available:'Disponible',low:'Baja',exhausted:'Agotada',unknown:'Sin medición'};
  return ids.map(id=>{
   const item=runtimes?.[id];
   const state=item&&states[item.state]||'Sin dato';
   const quota=item&&quotas[item.quotaState]||'Sin medición';
   return '<span>'+labels[id]+' · Autenticación</span><strong>'+state+'</strong>'
    +'<span>'+labels[id]+' · Cuota</span><strong>'+quota+'</strong>'
    +'<span>'+labels[id]+' · Observado</span><strong>'+(item&&Number.isFinite(Date.parse(item.observedAt))?clean(item.observedAt):'Sin dato')+'</strong>';
  }).join('');
 }
 function card(name,agent,state='unknown',runtimes={}){
  const o=occupancy(agent),q=quota(agent?.quota),turn=agent?.turnSeconds;
  const reset=q.percent===null?'Sin reinicio confirmado':resetLabel(agent?.quota?.resetsAt);
  const states={working:'Trabajando',waiting:'En espera',available:'Disponible',unknown:'Sin señal'};
  const st=states[state]||states.unknown;
  const width=q.percent===null?'': '<span class="mini-progress"><i style="width:'+q.percent+'%"></i></span>';
  return '<details class="agent-compact" data-agent="'+name+'">'
   +'<summary><span class="agent-identity"><strong>'+NAMES[name]+'</strong><small data-execution="'+clean(state)+'">'+clean(st)+'</small></span>'
   +'<span class="agent-occupancy"><span class="sr-only">Ocupación: </span><b>'+o.text+'</b><span class="occupancy-marks" aria-hidden="true">'+o.segments+'</span></span>'
   +'<span class="agent-quota" data-tone="'+q.tone+'"><b>'+q.text+'</b>'+width+'</span><span class="agent-expand" aria-hidden="true">⌄</span></summary>'
   +'<div class="agent-extra"><span>Turno actual</span><strong>'+turnLabel(turn)+'</strong>'
   +runtimeDetails(name,runtimes)
   +'<span>Cuota</span><strong>'+q.text+'</strong>'+'<span>Restablecimiento</span><strong>'+reset+'</strong>'
   +'<p>Ocupación, ejecución, autenticación y cuota son mediciones independientes. Autenticación no acredita cuota disponible.</p></div></details>';
 }
 return {occupancy,quota,currentTelemetry,liveStates,freshExecution,resetLabel,turnLabel,runtimeDetails,card};
});
