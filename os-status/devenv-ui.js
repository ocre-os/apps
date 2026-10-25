(() => {
 const monitor=new window.OcreDevenv.DevenvMonitor();
 const url='https://staging.ocre.mx/api/devenv';
 const D=window.OcreDevenv;
 let last=null,signature=null,agentLive=null,agentLiveAt=0;
 const ACTIVITY_TTL_MS=30000;
 function escapeHtml(value){return String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
 function agentRow(name,agent,state){
  // Occupancy, live activity, quota and authentication are different signals.
  const quota=D.quotaText(agent.quota);
  const activity=state?.states?.[name];
  const activityLabel=({working:'Trabajando',waiting:'En espera',available:'Sin turno',unknown:'Sin señal'})[activity]||'Sin señal';
  const capacity=agent.slotsUsed+'/'+agent.capacity;
  const bars=Array.from({length:Math.max(0,Math.min(8,agent.capacity))},(_,i)=>'<i class="'+(i<agent.slotsUsed?'occupied':'')+'"></i>').join('');
  const resetDate=agent.quota.resetsAt?new Date(agent.quota.resetsAt):null;
  const reset=resetDate&&Number.isFinite(resetDate.getTime())&&agent.quota.state!=='unknown'?' · reinicia '+new Intl.DateTimeFormat('es-MX',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}).format(resetDate):'';
  // ocre-devenv-v1 contains no authentication field. Do not fabricate login state.
  const auth='Autenticación: no evaluada';
  const quotaPercent=typeof agent.quota.remainingPercent==='number'&&Number.isFinite(agent.quota.remainingPercent)?Math.max(0,Math.min(100,agent.quota.remainingPercent)):null;
  const bar=quotaPercent!==null&&agent.quota.state!=='unknown'?'<span class="quota-bar" aria-hidden="true"><i style="width:'+quotaPercent+'%"></i></span>':'';
  return '<article class="agent-compact-row" data-agent="'+escapeHtml(name)+'"><div class="agent-compact-main"><strong>'+escapeHtml(D.NAMES[name])+'</strong>'
   +'<span class="agent-activity" data-state="'+escapeHtml(activity||'unknown')+'">'+escapeHtml(activityLabel)+'</span>'
   +'<span class="agent-capacity" role="img" aria-label="'+escapeHtml(capacity)+' tareas ocupadas"><span class="capacity-dots">'+bars+'</span>'+escapeHtml(capacity)+'</span>'
   +'<span class="agent-quota" data-tone="'+escapeHtml(quota.tone)+'">'+escapeHtml(quota.text)+bar+'</span></div>'
   +'<div class="agent-compact-meta"><span>Turno: '+escapeHtml(D.duration(agent.turnSeconds))+'</span><span>'+auth+'</span><span class="agent-reset">'+escapeHtml(reset.replace(/^ · /,''))+'</span></div></article>';
 }

 const dots={healthy:'#48e5a8',failed:'#ff5f6d',stale:'#b78cff'};
 function renderActivity(state){
  const list=document.getElementById('activityList'),count=document.getElementById('activityCount');
  const events=state.valid?state.events:[];
  count.textContent=events.length?events.length+' recientes':'Sin eventos';
  list.innerHTML=events.length?events.map((e)=>{const v=D.eventView(e);return '<li><i style="background:'+dots[v.tone]+'"></i><span>'+v.label+'</span><small>'+v.when+'</small></li>';}).join(''):'<li class="activity-empty">Sin eventos recientes.</li>';
 }
 function render(){
  const state=last&&Date.now()-Date.parse(last.observedAt)<=30000?last:D.normalize();
  if(agentLive&&Date.now()-agentLiveAt>ACTIVITY_TTL_MS){agentLive=null;agentLiveAt=0;}
  const next=(state.valid?state.observedAt:'none')+'|'+(last!==null)+'|'+JSON.stringify(agentLive?.states||{});
  if(next===signature)return;
  signature=next;
  const grid=document.getElementById('loadGrid');
  const cards=['claude','codex'].filter((n)=>state.agents[n]).map((n)=>agentRow(n,state.agents[n],agentLive)).join('');
  grid.innerHTML=cards||'<p class="load-empty">Sin medición reciente de la carga.</p>';
  document.getElementById('loadTime').textContent=state.valid?'Observado '+new Intl.DateTimeFormat('es-MX',{hour:'2-digit',minute:'2-digit',second:'2-digit'}).format(new Date(state.observedAt)):'Sin muestra reciente';
  renderActivity(state);
  window.dispatchEvent(new CustomEvent('ocre:devenv',{detail:{state,checked:last!==null}}));
 }
 async function check(){const cycle=monitor.cycle+1;const state=await monitor.check(url);if(cycle===monitor.cycle){last=state;render();}}
 window.addEventListener('ocre:agents',(event)=>{agentLive=event.detail?.stale?null:event.detail?.state||null;agentLiveAt=agentLive?Date.now():0;signature=null;render();});
 render();check();
 const refresh=setInterval(check,10000);const expiry=setInterval(render,1000);
 document.getElementById('refreshButton').addEventListener('click',check);
 document.addEventListener('visibilitychange',()=>{render();if(!document.hidden)check();});
 window.addEventListener('beforeunload',()=>{clearInterval(refresh);clearInterval(expiry);});
})();
