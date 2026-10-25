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
  const marks=Array.from({length:Math.min(agent.capacity,3)},(_,i)=>'<i class="'+(i<agent.slotsUsed?'filled':'')+'"></i>').join('');
  return {text:agent.slotsUsed+'/'+agent.capacity,segments:marks,valid:true};
 }
 function quota(q){
  if(!q||!['available','low','exhausted'].includes(q.state)||typeof q.remainingPercent!=='number'||!Number.isFinite(q.remainingPercent))
   return {text:'Sin medición',tone:'unknown',percent:null};
  const percent=Math.round(Math.max(0,Math.min(100,q.remainingPercent)));
  return {text:percent+'% restante',tone:q.state,percent};
 }
 function liveStates(info){
  const allowed=new Set(['working','waiting','available','unknown']);
  const states=info&&!info.stale&&info.state&&info.state.states;
  return Object.fromEntries(['claude','codex'].map(name=>[name,
   states&&allowed.has(states[name])?states[name]:'unknown']));
 }
 function card(name,agent,state='unknown'){
  const o=occupancy(agent),q=quota(agent?.quota),turn=agent?.turnSeconds;
  const validTurn=Number.isFinite(turn)&&turn>=0;
  const states={working:'Trabajando',waiting:'En espera',available:'Disponible',unknown:'Sin señal'};
  const st=states[state]||states.unknown;
  const width=q.percent===null?'': '<span class="mini-progress"><i style="width:'+q.percent+'%"></i></span>';
  return '<details class="agent-compact" data-agent="'+name+'">'
   +'<summary><span class="agent-identity"><strong>'+NAMES[name]+'</strong><small data-execution="'+clean(state)+'">'+clean(st)+'</small></span>'
   +'<span class="agent-occupancy"><span class="sr-only">Ocupación: </span><b>'+o.text+'</b><span class="occupancy-marks" aria-hidden="true">'+o.segments+'</span></span>'
   +'<span class="agent-quota" data-tone="'+q.tone+'"><b>'+q.text+'</b>'+width+'</span><span class="agent-expand" aria-hidden="true">⌄</span></summary>'
   +'<div class="agent-extra"><span>Turno actual</span><strong>'+(validTurn?(turn===0?'Sin turno':turn<60?turn+' s':Math.floor(turn/60)+' min'):'Sin señal')+'</strong>'
   +'<span>Autenticación</span><strong>Sin señal pública</strong>'
   +'<span>Cuota</span><strong>'+q.text+'</strong>'
   +'<p>Ocupación, ejecución y cuota son mediciones independientes. La autenticación por runtime aún no se publica en esta API.</p></div></details>';
 }
 return {occupancy,quota,liveStates,card};
});
