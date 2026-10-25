(() => {
 const monitor=new window.OcreDevenv.DevenvMonitor();
 const url='https://staging.ocre.mx/api/devenv';
 const D=window.OcreDevenv;
 let last=null,signature=null;
 const tones={healthy:'#48e5a8',degraded:'#ffc857',failed:'#ff5f6d',neutral:'#9fb0b7'};
 let agentStates={claude:'unknown',codex:'unknown'};
 window.addEventListener('ocre:agents',(event)=>{
  const info=event.detail;
  agentStates=info?.state?.states||{claude:'unknown',codex:'unknown'};
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
  const next=(state.valid?state.observedAt:'none')+'|'+(last!==null);
  if(next===signature)return;
  signature=next;
  const grid=document.getElementById('loadGrid');
  const cards=['claude','codex'].filter((n)=>state.agents[n]).map((n)=>window.OcreCompact.card(n,state.agents[n],agentStates[n])).join('');
  grid.innerHTML=cards||'<p class="load-empty">Sin medición reciente de la carga.</p>';
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
