(() => {
 const monitor=new window.OcreXpress.XpressMonitor();
 const url='https://staging.ocre.mx/api/xpress-status';
 const labels={ok:'Al día',late:'Atención tardía',reconcile:'Requiere reconciliar',disabled:'No habilitado',unknown:'Sin información'};
 const details={ok:'Sin entregas vencidas',late:'Hay una entrega pendiente de más de 15 minutos',reconcile:'Hay entregas con lease vencido o bloqueadas',disabled:'Xpress está apagado en este entorno',unknown:'Sin una señal reciente confirmada'};
 let last=null;
 function render(){
  const state=last&&Date.now()-Date.parse(last.observedAt)<=30000?last:window.OcreXpress.normalize();
  const card=document.getElementById('xpress-card');
  card.dataset.state=state.state;
  card.querySelector('.agent-state').textContent=labels[state.state];
  card.querySelector('.agent-detail').textContent=details[state.state];
  window.dispatchEvent(new CustomEvent('ocre:xpress',{detail:{state,checked:last!==null}}));
  const c=state.counts;
  document.getElementById('xpress-counts').textContent=state.state==='ok'||state.state==='late'||state.state==='reconcile'
   ?`Pendientes ${c.pending} · Reclamadas ${c.claimed} · Vencidas ${c.lease_expired} · Bloqueadas ${c.blocked} · Confirmadas 24 h ${c.acked_24h}`:'';
 }
 async function check(){const cycle=monitor.cycle+1;const state=await monitor.check(url);if(cycle===monitor.cycle){last=state;render();}}
 render();check();
 const refresh=setInterval(check,10000);const expiry=setInterval(render,1000);
 document.getElementById('refreshButton').addEventListener('click',check);
 document.addEventListener('visibilitychange',()=>{render();if(!document.hidden)check();});
 window.addEventListener('beforeunload',()=>{clearInterval(refresh);clearInterval(expiry);});
})();
