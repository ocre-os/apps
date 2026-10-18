(() => {
 const monitor=new window.OcreDevenv.DevenvMonitor();
 const url='https://staging.ocre.mx/api/devenv';
 const D=window.OcreDevenv;
 let last=null,signature=null;
 const tones={healthy:'#48e5a8',degraded:'#ffc857',failed:'#ff5f6d',neutral:'#9fb0b7'};
 function gauge(name,agent){
  const g=D.geometry(agent.slotsUsed,agent.capacity),tone=D.loadTone(agent.slotsUsed,agent.capacity),color=tones[tone];
  const quota=D.quotaText(agent.quota);
  return '<article class="gauge-card" data-agent="'+name+'"><header><strong>'+D.NAMES[name]+'</strong><span class="gauge-load" style="color:'+color+'">'+D.loadLabel(agent.slotsUsed,agent.capacity)+'</span></header>'
   +'<svg viewBox="0 0 160 100" width="200" height="125" role="img" aria-label="'+D.NAMES[name]+': '+agent.slotsUsed+' de '+agent.capacity+' tareas activas">'
   +'<path d="'+g.track+'" fill="none" stroke="#1c2a31" stroke-width="12" stroke-linecap="round"/>'
   +(g.arc?'<path d="'+g.arc+'" fill="none" stroke="'+color+'" stroke-width="12" stroke-linecap="round"/>':'')
   +'<line x1="80" y1="78" x2="'+g.needle[0]+'" y2="'+g.needle[1]+'" stroke="#eaf3f5" stroke-width="2.5" stroke-linecap="round"/><circle cx="80" cy="78" r="5" fill="#eaf3f5"/>'
   +'<text x="14" y="98" fill="#78909a" font-size="9" text-anchor="middle">0</text><text x="80" y="9" fill="#78909a" font-size="9" text-anchor="middle">'+(agent.capacity/2)+'</text><text x="146" y="98" fill="#78909a" font-size="9" text-anchor="middle">'+agent.capacity+'</text></svg>'
   +'<p class="gauge-count"><strong>'+agent.slotsUsed+'</strong> / '+agent.capacity+'<small>tareas activas</small></p>'
   +'<dl class="gauge-rows"><dt>Turno en curso</dt><dd>'+D.duration(agent.turnSeconds)+'</dd><dt>Cuota</dt><dd style="color:'+tones[quota.tone]+'">'+quota.text+'</dd></dl></article>';
 }
 const dots={healthy:'#48e5a8',failed:'#ff5f6d',stale:'#b78cff'};
 function renderActivity(state){
  const list=document.getElementById('activityList'),count=document.getElementById('activityCount');
  const events=state.valid?state.events:[];
  count.textContent=events.length?events.length+' recientes':'Sin eventos';
  list.innerHTML=events.length?events.map((e)=>{const v=D.eventView(e);return '<li><i style="background:'+dots[v.tone]+'"></i><span>'+v.label+'</span><small>'+v.when+'</small></li>';}).join(''):'<li class="activity-empty">Sin eventos recientes.</li>';
 }
 function renderBackups(state){
  for(const env of ['core','staging']){
   const card=document.getElementById('backup-'+env);
   const view=D.backupView(state.valid?state.backups[env]:null,env);
   card.dataset.state=view.tone;
   card.querySelector('.agent-state').textContent=view.label;
   card.querySelector('.agent-detail').textContent=view.text;
  }
 }
 function render(){
  const state=last&&Date.now()-Date.parse(last.observedAt)<=30000?last:D.normalize();
  const next=(state.valid?state.observedAt:'none')+'|'+(last!==null);
  if(next===signature)return;
  signature=next;
  const grid=document.getElementById('loadGrid');
  const cards=['claude','codex'].filter((n)=>state.agents[n]).map((n)=>gauge(n,state.agents[n])).join('');
  grid.innerHTML=cards||'<p class="load-empty">Sin medición reciente de la carga.</p>';
  document.getElementById('loadTime').textContent=state.valid?'Observado '+new Intl.DateTimeFormat('es-MX',{hour:'2-digit',minute:'2-digit',second:'2-digit'}).format(new Date(state.observedAt)):'Sin muestra reciente';
  renderActivity(state);
  renderBackups(state);
  window.dispatchEvent(new CustomEvent('ocre:devenv',{detail:{state,checked:last!==null}}));
 }
 async function check(){const cycle=monitor.cycle+1;const state=await monitor.check(url);if(cycle===monitor.cycle){last=state;render();}}
 render();check();
 const refresh=setInterval(check,10000);const expiry=setInterval(render,1000);
 document.getElementById('refreshButton').addEventListener('click',check);
 document.addEventListener('visibilitychange',()=>{render();if(!document.hidden)check();});
 window.addEventListener('beforeunload',()=>{clearInterval(refresh);clearInterval(expiry);});
})();
