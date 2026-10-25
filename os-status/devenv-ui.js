(() => {
 const monitor=new window.OcreDevenv.DevenvMonitor();
 const url='https://staging.ocre.mx/api/devenv';
 const D=window.OcreDevenv;
 let last=null,signature=null;
 let agentStates={claude:'unknown',codex:'unknown'};
 let agentsObservedAt=0;
 window.addEventListener('ocre:agents',(event)=>{
  const info=event.detail;
  // A state is live only while the source continues reporting fresh evidence.
  agentStates=window.OcreCompact.liveStates(info);
  agentsObservedAt=info&&!info.stale&&info.state&&Number.isFinite(Date.parse(info.state.observedAt))?Date.parse(info.state.observedAt):0;
  signature=null;render();
 });
 const dots={healthy:'#48e5a8',failed:'#ff5f6d',stale:'#b78cff'};
 function renderActivity(state){
  const list=document.getElementById('activityList'),count=document.getElementById('activityCount');
  const events=state.valid?state.events:[];
  count.textContent=events.length?events.length+' recientes':'Sin eventos';
  list.innerHTML=events.length?events.map((e)=>{const v=D.eventView(e);return '<li><i style="background:'+dots[v.tone]+'"></i><span>'+v.label+'</span><small>'+v.when+'</small></li>';}).join(''):'<li class="activity-empty">Sin eventos recientes.</li>';
 }
 function render(){
  const state=last&&Date.now()-Date.parse(last.observedAt)<=30000?last:D.normalize();
  const live=window.OcreCompact.freshExecution(agentStates,agentsObservedAt);
  const current=window.OcreCompact.currentTelemetry(state);
  const quotaEpoch=current&&['claude','codex'].some(n=>{
    const at=Date.parse(state.agents[n]?.quota?.resetsAt);
    return Number.isFinite(at)&&at<=Date.now();
  });
  // Time-based transitions must repaint even without a new HTTP response.
  const next=(current?state.observedAt:'stale')+'|'+(last!==null)+'|'+live.claude+'|'+live.codex+'|'+quotaEpoch;
  if(next===signature)return;
  signature=next;
  const grid=document.getElementById('loadGrid');
  // Preserve expanded panels and focus as telemetry refreshes every 10 seconds.
  const expanded=new Set(Array.from(grid.querySelectorAll('details.agent-compact[open]')).map(el=>el.dataset.agent));
  const focusName=document.activeElement?.closest?.('details.agent-compact')?.dataset.agent;
  const focusOnSummary=focusName&&document.activeElement?.tagName==='SUMMARY';
  // Only current, schema-valid telemetry may show occupancy or quota.
  const cards=current?['claude','codex'].filter((n)=>state.agents[n]).map((n)=>window.OcreCompact.card(n,state.agents[n],live[n],state.runtimes)).join(''):'';
  grid.innerHTML=cards||'<p class="load-empty">Sin medición reciente de la carga.</p>';
  for(const el of grid.querySelectorAll('details.agent-compact'))if(expanded.has(el.dataset.agent))el.open=true;
  if(focusOnSummary){const target=Array.from(grid.querySelectorAll('details.agent-compact')).find(el=>el.dataset.agent===focusName);target?.querySelector('summary')?.focus();}
  document.getElementById('loadTime').textContent=state.valid?'Observado '+new Intl.DateTimeFormat('es-MX',{hour:'2-digit',minute:'2-digit',second:'2-digit'}).format(new Date(state.observedAt)):'Sin muestra reciente';
  renderActivity(state);
  window.dispatchEvent(new CustomEvent('ocre:devenv',{detail:{state,checked:last!==null}}));
 }
 async function check(){const cycle=monitor.cycle+1;const state=await monitor.check(url);if(cycle===monitor.cycle){last=state;render();}}
 render();check();
 const refresh=setInterval(check,10000);const expiry=setInterval(render,1000);
 document.getElementById('refreshButton').addEventListener('click',check);
 document.addEventListener('visibilitychange',()=>{render();if(!document.hidden)check();});
 window.addEventListener('beforeunload',()=>{clearInterval(refresh);clearInterval(expiry);});
})();
