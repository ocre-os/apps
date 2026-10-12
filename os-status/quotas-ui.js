(() => {
 const monitor=new window.OcreQuotas.QuotaMonitor();
 const url='https://staging.ocre.mx/api/resource-quotas';
 const labels={available:'Disponible',limited:'Reserva baja',exhausted:'Cuota agotada',unknown:'Sin datos'};
 const units={percent:'%',minutes:'min',requests:'solicitudes',credits:'créditos',usd:'USD'};
 let latest=window.OcreQuotas.normalize();
 const host=document.getElementById('quotas-grid');
 for(const [id,name,group] of window.OcreQuotas.services){
  const card=document.createElement('article');card.className='quota-card';card.dataset.state='unknown';card.id='quota-'+id;
  const title=document.createElement('h3');title.textContent=name;
  const category=document.createElement('small');category.textContent=group;
  const state=document.createElement('p');state.className='quota-state';
  const detail=document.createElement('p');detail.className='quota-detail';
  card.append(category,title,state,detail);host.append(card);
 }
 function render(){
  const recent=latest.observedAt&&Date.now()-Date.parse(latest.observedAt)<=300000;
  const state=recent?latest:window.OcreQuotas.normalize();
  for(const [id] of window.OcreQuotas.services){
   const card=document.getElementById('quota-'+id);const x=state.services[id];
   card.dataset.state=x.state;
   card.querySelector('.quota-state').textContent=labels[x.state];
   const lines=[];
   if(x.remaining!==null&&x.unit)lines.push('Restante: '+x.remaining+' '+units[x.unit]);
   if(x.resetsAt)lines.push('Restablece: '+new Intl.DateTimeFormat('es-MX',{dateStyle:'short',timeStyle:'short'}).format(new Date(x.resetsAt)));
   if(x.source)lines.push('Fuente: '+x.source);
   card.querySelector('.quota-detail').textContent=lines.join(' · ')||'Sin telemetría de cuota verificada';
  }
  document.getElementById('quotas-time').textContent=state.observedAt?
   'Muestra '+new Intl.DateTimeFormat('es-MX',{timeStyle:'medium'}).format(new Date(state.observedAt)):'Sin muestra verificable';
 }
 async function check(){
  const result=await monitor.check(url);
  if(result.latest){latest=result.state;render();}
 }
 render();check();
 const polling=setInterval(check,60000);
 const expiry=setInterval(render,15000);
 document.getElementById('refreshButton').addEventListener('click',check);
 document.addEventListener('visibilitychange',()=>{render();if(!document.hidden)check();});
 window.addEventListener('beforeunload',()=>{clearInterval(polling);clearInterval(expiry);});
})();
