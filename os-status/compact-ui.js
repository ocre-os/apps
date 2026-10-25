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
  if(!q||!['available','low','exhausted'].includes(q.state)||typeof q.remainingPercent!=='number'||!Number.isFinite(q.remainingPercent)||q.remainingPercent<0||q.remainingPercent>100||(q.state==='exhausted'&&q.remainingPercent!==0))
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
  if(!Number.isFinite(at))return 'Sin reinicio confirmado';
  const label=new Intl.DateTimeFormat('es-MX',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit',timeZoneName:'short'}).format(new Date(at));
  return at<=now?'Reinicio vencido · '+label:'Reinicia '+label;
 }
 function turnLabel(seconds){
  if(!Number.isFinite(seconds)||seconds<0)return 'Sin señal';
  seconds=Math.floor(seconds);
  if(seconds===0)return 'Sin turno';
  if(seconds<60)return seconds+' s';
  if(seconds<3600)return Math.floor(seconds/60)+' min';
  return Math.floor(seconds/3600)+' h '+String(Math.floor(seconds%3600/60)).padStart(2,'0')+' min';
 }
 function card(name,agent,state='unknown'){
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
   +'<span>Autenticación</span><strong>Sin señal pública</strong>'
   +'<span>Cuota</span><strong>'+q.text+'</strong>'+'<span>Restablecimiento</span><strong>'+reset+'</strong>'
   +'<p>Ocupación, ejecución y cuota son mediciones independientes. La autenticación por runtime aún no se publica en esta API.</p></div></details>';
 }
 return {occupancy,quota,currentTelemetry,liveStates,freshExecution,resetLabel,turnLabel,card};
});
