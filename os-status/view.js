(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports) module.exports=api;
 else root.OcreView=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 // OCRE-058 F1: lógica pura de la vista (sin DOM). `not_configured`/`disabled` son neutros: no son falla ni degradan el veredicto.
 const CHECKS=['web','api','database','schema','worker','storage','notifications','pwa'];
 const SEVERITY={failed:0,stale:1,degraded:2,unknown:3};
 const AGENT_LABEL={working:'Trabajando',waiting:'En espera',available:'Disponible',unknown:'Sin información'};
 const reasonText={
  no_heartbeat:'Aún no ha reportado actividad.',invalid_heartbeat:'Su señal de actividad no es válida.',clock_skew:'El reloj del servicio no coincide.',
  heartbeat_stale:'Su última señal de actividad es antigua.',heartbeat_expired:'Dejó de reportar actividad.',
  not_writable:'No se puede escribir en el almacenamiento.',read_mismatch:'La lectura de prueba no coincide.',
  no_channel_configured:'No hay canal de salida configurado.',backlog:'Hay notificaciones pendientes vencidas.',query_failed:'No se pudo consultar la cola.',
  schema_not_ready:'Esperando un esquema válido.',database_unavailable:'Base de datos no disponible.',
  not_configured:'Sondeo no configurado.',manifest_invalid:'El manifiesto no es válido.',manifest_unavailable:'No hay manifiesto.',
  service_worker_unavailable:'No hay service worker.',web_unreachable:'No se alcanza el portal.'};
 const names={web:'Acceso externo',api:'API',database:'PostgreSQL',schema:'Esquema / migraciones',worker:'Notification worker',storage:'Almacenamiento',notifications:'Canales de salida',pwa:'PWA'};
 function checkView(state,key){
  const value=state?.checks?.[key]||'unknown';
  const reason=state?.reasons?.[key];
  if(value==='not_configured')return {status:'not_configured',text:reasonText[reason]||'No configurado.'};
  // Compatibilidad: backends anteriores a OCRE-058 F2 informaban este caso como `unknown`.
  if(key==='notifications'&&value==='unknown'&&reason==='no_channel_configured')return {status:'not_configured',text:'No hay canal de salida configurado.'};
  if(value==='stale')return {status:'stale',text:'Muestra antigua; sin evidencia vigente.'};
  return {status:value,text:value!=='healthy'&&reasonText[reason]?reasonText[reason]:''};
 }
 function platformView(state){
  if(!state)return {tone:'unknown',label:'Comprobando',text:'Consultando la plataforma.'};
  let ok=0,counted=0,neutral=0;
  for(const key of CHECKS){const s=checkView(state,key).status;if(s==='not_configured'){neutral++;continue;}counted++;if(s==='healthy')ok++;}
  const tone=state.overall==='stale'?'stale':state.overall;
  const label={healthy:'Operativa',degraded:'Degradada',failed:'Con falla',stale:'Obsoleta',unknown:'Sin señal'}[tone]||'Sin señal';
  return {tone,label,text:ok+' de '+counted+' puntos operativos'+(neutral?' · '+neutral+' sin configurar':'')};
 }
 function agentsView(agents,monitorStale,devenvIssues){
  if(monitorStale)return {tone:'stale',label:'Monitor detenido',text:'monitor_stale · sin muestra reciente'};
  if(devenvIssues&&devenvIssues.length)return {tone:'degraded',label:'Atención',text:devenvIssues.map((i)=>i.short).join(' · ')};
  const c=agents?.states?.claude||'unknown',x=agents?.states?.codex||'unknown';
  const tone=c==='unknown'||x==='unknown'?'unknown':'healthy';
  return {tone,label:tone==='healthy'?'En línea':'Sin señal',text:'Claude '+AGENT_LABEL[c]+' · Codex '+AGENT_LABEL[x]};
 }
 function xpressView(xpress){
  const s=xpress?.state||'unknown';
  return ({ok:{tone:'healthy',label:'Al día'},late:{tone:'degraded',label:'Atención tardía'},reconcile:{tone:'degraded',label:'Requiere reconciliar'},disabled:{tone:'neutral',label:'No habilitado'},unknown:{tone:'unknown',label:'Sin información'}})[s]||{tone:'unknown',label:'Sin información'};
 }
 function devView(state,xpress,validationIssues){
  const x=xpressView(xpress),version=state?.deployment?.version;
  if(validationIssues&&validationIssues.length)return {tone:'degraded',label:'Atención',text:validationIssues.map((i)=>i.short).join(' · ')};
  const sha=state?.deployment?.commit;
  return {tone:x.tone,label:x.tone==='neutral'?'Sin señales aún':x.label,text:'Versión '+(version||'—')+(sha?' · '+String(sha).slice(0,7):'')+' · Xpress '+x.label.toLowerCase()};
 }
 function attention(state,agents,xpress,flags={}){
  const items=[];
  for(const issue of flags.devenvIssues||[])items.push({domain:'Agentes',name:issue.name,tone:'degraded',text:issue.text});
  if(state){
   for(const key of CHECKS){const v=checkView(state,key);if(!['healthy','not_configured'].includes(v.status))items.push({domain:'Plataforma',name:names[key],tone:v.status,text:v.text||'Sin evidencia suficiente.'});}
   if(state.overall==='stale'&&!items.length)items.push({domain:'Plataforma',name:'Muestra',tone:'stale',text:'La última muestra es antigua.'});
  }
  if(flags.agentsChecked){
   if(flags.monitorStale)items.push({domain:'Agentes',name:'Monitor de agentes',tone:'stale',text:'monitor_stale: el monitor dejó de publicar.'});
   else if(agents&&Object.values(agents.states||{}).includes('unknown'))items.push({domain:'Agentes',name:'Agentes',tone:'unknown',text:'Falta la señal de uno de los agentes.'});
  }
  for(const issue of flags.validationIssues||[])items.push({domain:'Desarrollo',name:issue.name,tone:'degraded',text:issue.text});
  const x=xpress?.state;
  if(x==='late'||x==='reconcile')items.push({domain:'Desarrollo',name:'Bandeja Xpress',tone:'degraded',text:x==='late'?'Hay una entrega pendiente de más de 15 minutos.':'Hay entregas con lease vencido o bloqueadas.'});
  else if(flags.xpressChecked&&x==='unknown')items.push({domain:'Desarrollo',name:'Bandeja Xpress',tone:'unknown',text:'Sin una señal reciente confirmada.'});
  return items.sort((a,b)=>SEVERITY[a.tone]-SEVERITY[b.tone]);
 }
 function verdictText(items,state){
  if(!state)return 'Consultando los puntos críticos.';
  if(!items.length)return 'Todo en orden.';
  return items.length===1?'1 cosa pide atención.':items.length+' cosas piden atención.';
 }
 return {CHECKS,names,checkView,platformView,agentsView,xpressView,devView,attention,verdictText};
});
