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
