(() => {
 const monitor=new window.OcreAgents.AgentMonitor();
 const url='https://staging.ocre.mx/api/agents';
 const labels={working:'Trabajando',waiting:'En espera',available:'Disponible',unknown:'Sin información'};
 let last=null;
 function render(){
  const state=last&&Date.now()-Date.parse(last.observedAt)<=30000?last:window.OcreAgents.normalize();
  for(const name of ['claude','codex']){
   const card=document.getElementById('agent-'+name);
   card.dataset.state=state.states[name];
   card.querySelector('.agent-state').textContent=labels[state.states[name]];
   card.querySelector('.agent-detail').textContent=state.reasons[name]==='waiting_approval'?'Espera tu aprobación':
    state.reasons[name]==='waiting_input'?'Espera tu respuesta':
    state.states[name]==='working'?'Tarea en curso':
    state.states[name]==='waiting'?'Sesión abierta sin tarea activa':
    state.states[name]==='available'?'Sin sesión activa confirmada':'Sin una señal reciente confirmada';
  }
  const capacityLabels={available:'Disponible',exhausted:'Cuota agotada',
   temporarily_unavailable:'No disponible',unknown:'Sin información'};
  const reasonLabels={quota:'Límite de uso del proveedor',permission:'Permisos insuficientes',
   service:'Servicio no disponible',runner_offline:'Runner desconectado',
   timeout:'Consulta sin respuesta',not_checked:'Sin verificación reciente',
   none:'Capacidad observada'};
  let observed=[];
  for(const provider of window.OcreAgents.capacityProviders){
   const card=document.getElementById('capacity-'+provider);
   if(!card)continue;
   const entry=state.capacity?.[provider]||{availability:'unknown',reason:'not_checked'};
   card.dataset.state=entry.availability==='available'?'available':
      entry.availability==='exhausted'?'waiting':'unknown';
   card.querySelector('.agent-state').textContent=capacityLabels[entry.availability]||'Sin información';
   card.querySelector('.agent-detail').textContent=entry.availability==='unknown'
     ?'Sin verificación reciente; no autoriza ejecución'
     :(reasonLabels[entry.reason]||'Revisar evidencia del proveedor');
   if(entry.observedAt)observed.push(Date.parse(entry.observedAt));
  }
  const capacityTime=document.getElementById('capacity-time');
  if(capacityTime)capacityTime.textContent=observed.length
    ?'Última muestra '+new Intl.DateTimeFormat('es-MX',{hour:'2-digit',minute:'2-digit'}).format(new Date(Math.max(...observed)))
    :'Sin telemetría validada';
  document.getElementById('agents-time').textContent=state.observedAt
   ?'Observado '+new Intl.DateTimeFormat('es-MX',{hour:'2-digit',minute:'2-digit',second:'2-digit'}).format(new Date(state.observedAt))
   :'Sin muestra reciente';
 }
 async function check(){
  const cycle=monitor.cycle+1;
  const state=await monitor.check(url);
  if(cycle===monitor.cycle){last=state;render();}
 }
 render();check();
 const refresh=setInterval(check,10000);
 const expiry=setInterval(render,1000);
 document.getElementById('refreshButton').addEventListener('click',check);
 document.addEventListener('visibilitychange',()=>{render();if(!document.hidden)check();});
 window.addEventListener('beforeunload',()=>{clearInterval(refresh);clearInterval(expiry);});
})();
