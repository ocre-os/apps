(() => {
 const monitor=new window.OcreDevenv.DevenvMonitor();
 const url='https://staging.ocre.mx/api/devenv';
 const D=window.OcreDevenv;
 let last=null,signature=null,renderedCards=null;
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
  const raw=last&&Date.now()-Date.parse(last.observedAt)<=30000?last:D.normalize();
  // The same quota expiry is applied to agent cards, attention and domains.
  const state=window.OcreCompact.expireQuotaWindows(raw);
  const live=window.OcreCompact.freshExecution(agentStates,agentsObservedAt);
  // Expired quota windows must become unknown without needing a new HTTP poll.
  const windowExpiry=['claude','codex'].map(n=>{
   const reset=Date.parse(state.agents?.[n]?.quota?.resetsAt);
   return Number.isFinite(reset)&&reset<=Date.now()?'expired':'future';
  }).join(',');
  const next=(state.valid?state.observedAt:'none')+'|'+(last!==null)+'|'+live.claude+'|'+live.codex+'|'+windowExpiry;
  if(next===signature)return;
  signature=next;
  const grid=document.getElementById('loadGrid');
  // Preserve expanded panels and focus as telemetry refreshes every 10 seconds.
  const expanded=new Set(Array.from(grid.querySelectorAll('details.agent-compact[open]')).map(el=>el.dataset.agent));
  const focusName=document.activeElement?.closest?.('details.agent-compact')?.dataset.agent;
  const focusOnSummary=focusName&&document.activeElement?.tagName==='SUMMARY';
  // Only current, schema-valid telemetry may show occupancy or quota.
  const current=window.OcreCompact.currentTelemetry(state);
  // Keep both agent rows visible when telemetry expires, with unknown numbers,
  // rather than making the dashboard look as though information was deleted.
  const cards=['claude','codex'].map((n)=>
   window.OcreCompact.card(n,current?state.agents[n]||null:null,live[n])).join('');
  // Do not destroy open panels or text selection when values are unchanged.
  // Polling is every 10s; changing only observed_at must not disturb the DOM.
  if(cards!==renderedCards){
   grid.innerHTML=cards;
   renderedCards=cards;
   for(const el of grid.querySelectorAll('details.agent-compact'))if(expanded.has(el.dataset.agent))el.open=true;
   if(focusOnSummary){const target=Array.from(grid.querySelectorAll('details.agent-compact')).find(el=>el.dataset.agent===focusName);target?.querySelector('summary')?.focus();}
  }
  const sampleTime=Date.parse(state.observedAt);
  document.getElementById('loadTime').textContent=current&&Number.isFinite(sampleTime)
   ?'Última muestra: hace '+Math.max(0,Math.floor((Date.now()-sampleTime)/1000))+' s'
   :'Sin muestra vigente';
  renderActivity(state);
  window.dispatchEvent(new CustomEvent('ocre:devenv',{detail:{state,checked:last!==null}}));
 }
 async function check(){const cycle=monitor.cycle+1;const state=await monitor.check(url);if(cycle===monitor.cycle){last=state;render();}}
 render();check();
 const refresh=setInterval(check,10000);
 const expiry=setInterval(()=>{
  render();
  if(last&&window.OcreCompact.currentTelemetry(last)){
   document.getElementById('loadTime').textContent='Última muestra: hace '+Math.max(0,Math.floor((Date.now()-Date.parse(last.observedAt))/1000))+' s';
  }
 },1000);
 document.getElementById('refreshButton').addEventListener('click',check);
 document.addEventListener('visibilitychange',()=>{render();if(!document.hidden)check();});
 window.addEventListener('beforeunload',()=>{clearInterval(refresh);clearInterval(expiry);});
})();
