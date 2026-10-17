(() => {
  const { StatusMonitor, applyStaleness } = window.OcreStatus;
  const targets = {
    core: { label: 'CORE', url: 'https://os.ocre.mx/api/status' },
    staging: { label: 'STAGING', url: 'https://staging.ocre.mx/api/status' },
  };
  const checkMeta = {
    web:['Acceso externo','El portal responde desde Internet.'],
    api:['API','Servicio de aplicación y diagnóstico.'],
    database:['PostgreSQL','Conectividad con la base de datos.'],
    schema:['Esquema / migraciones','Compatibilidad del esquema desplegado.'],
    worker:['Notification worker','Procesamiento asíncrono de notificaciones.'],
    storage:['Almacenamiento','Disponibilidad de archivos operativos.'],
    notifications:['Canales de salida','Correo y canales externos observables.'],
    pwa:['PWA','Recursos de aplicación instalable.'],
  };
  const monitor = new StatusMonitor({ timeoutMs: 5500 });
  let selected = 'core';
  let timer = null;
  let checking = false;
  let lastState = null;
  let rawState = null;
  let orbCycleTimer = null;
  const $ = (id) => document.getElementById(id);

  function statusText(value){return ({healthy:'OPERATIVO',degraded:'DEGRADADO',failed:'FALLA',stale:'OBSOLETO',unknown:'DESCONOCIDO'})[value] || 'DESCONOCIDO'}
  function message(state){
    if(state.overall==='healthy') return 'Los puntos críticos observables responden correctamente.';
    if(state.overall==='degraded') return 'OCRE-OS responde, pero uno o más servicios secundarios requieren atención.';
    if(state.overall==='failed') return 'Hay una interrupción crítica que puede impedir el acceso normal a OCRE-OS.';
    if(state.overall==='stale') return 'La última muestra es antigua: no se confirma el estado actual del entorno.';
    return 'No existe evidencia suficiente para confirmar el estado completo del entorno.';
  }
  const reasonText={
    no_heartbeat:'Aún no ha reportado actividad.',invalid_heartbeat:'Su señal de actividad no es válida.',clock_skew:'El reloj del servicio no coincide.',
    heartbeat_stale:'Su última señal de actividad es antigua.',heartbeat_expired:'Dejó de reportar actividad.',
    not_writable:'No se puede escribir en el almacenamiento.',read_mismatch:'La lectura de prueba no coincide.',
    no_channel_configured:'No hay canal de salida configurado.',backlog:'Hay notificaciones pendientes vencidas.',query_failed:'No se pudo consultar la cola.',
    schema_not_ready:'Esperando un esquema válido.',database_unavailable:'Base de datos no disponible.',
    not_configured:'Sondeo no configurado.',manifest_invalid:'El manifiesto no es válido.',manifest_unavailable:'No hay manifiesto.',
    service_worker_unavailable:'No hay service worker.',web_unreachable:'No se alcanza el portal.'};
  function checkDetail(state,key,value,desc){
    if(value==='stale') return 'Muestra antigua; sin evidencia vigente.';
    const reason=state.reasons&&state.reasons[key];
    return reason&&reasonText[reason]&&value!=='healthy'?reasonText[reason]:desc;
  }
  function formatTime(iso){if(!iso)return '—';return new Intl.DateTimeFormat('es-MX',{hour:'2-digit',minute:'2-digit',second:'2-digit'}).format(new Date(iso))}
  function renderChecks(state){
    $('checksGrid').innerHTML = Object.entries(checkMeta).map(([key,[name,desc]])=>{
      const value=state.checks[key]||'unknown';
      return '<article class="check" data-status="'+value+'"><div class="check-head"><div><span class="check-label">CHECK / '+key.toUpperCase()+'</span><div class="check-name">'+name+'</div></div><span class="check-status">'+statusText(value)+'</span></div><p>'+checkDetail(state,key,value,desc)+'</p></article>';
    }).join('');
  }
  const orbColors={healthy:'#48e5a8',degraded:'#ffc857',failed:'#ff5f6d',stale:'#b78cff',unknown:'#7d8b92'};
  function orbStates(state){
    const present=new Set([state.overall,...Object.values(state.checks||{})]);
    return ['failed','degraded','stale','unknown','healthy'].filter(value=>present.has(value));
  }
  function setOrbColor(orb,status,transitionMs=0){
    orb.style.setProperty('--orb-color',orbColors[status]||orbColors.unknown);
    orb.style.setProperty('--orb-transition',transitionMs+'ms');
    orb.dataset.currentStatus=status;
  }
  function renderOrb(state){
    const orb=$('statusOrb'),states=orbStates(state);
    clearTimeout(orbCycleTimer);
    orb.className='status-orb '+state.overall+(states.length>1?' has-secondary':'');
    orb.dataset.states=states.join(' ');
    setOrbColor(orb,state.overall,0);
    if(states.length<2)return;
    let index=states.indexOf(state.overall);
    const advance=()=>{
      index=(index+1)%states.length;
      setOrbColor(orb,states[index],2000);
      orbCycleTimer=setTimeout(advance,3000);
    };
    orbCycleTimer=setTimeout(advance,1000);
  }
  function render(state){
    rawState=state;
    state=applyStaleness(state);
    lastState=state;
    const target=targets[selected];
    $('environmentName').textContent=target.label;
    $('overallLabel').textContent=statusText(state.overall);
    $('heroMessage').textContent=message(state);
    renderOrb(state);
    $('latency').textContent=state.latencyMs==null?'—':state.latencyMs+' ms';
    $('checkedAt').textContent=formatTime(state.checkedAt);
    $('age').textContent='muestra actual';
    $('contractState').textContent=state.contractValid?'VÁLIDO':'NO DISPONIBLE';
    $('version').textContent=state.deployment?.version||'—';
    $('commit').textContent=state.deployment?.commit?'commit '+state.deployment.commit:'commit no informado';
    $('cycleState').textContent='Ciclo '+state.cycleId+' · '+formatTime(state.checkedAt);
    renderChecks(state);
    if(window.OcreMatrix) window.OcreMatrix.setTelemetry(target.label,state);
  }
  function loadingDots(){return '<span class="loading-dots" aria-label="Comprobando"><i></i><i></i><i></i></span>'}
  function renderChecking(){
    $('environmentName').textContent=targets[selected].label;
    $('overallLabel').innerHTML=loadingDots();
    $('heroMessage').innerHTML=loadingDots();
    $('statusOrb').className='status-orb checking loading-placeholder';
    $('latency').innerHTML=loadingDots();
    $('checkedAt').innerHTML=loadingDots();
    $('age').textContent='';
    $('contractState').innerHTML=loadingDots();
    $('version').innerHTML=loadingDots();
    $('commit').textContent='';
    $('cycleState').innerHTML=loadingDots();
    $('checksGrid').innerHTML='';
  }
  async function check(){
    checking=true;$('refreshButton').classList.add('loading');renderChecking();
    const envAtStart=selected;
    const state=await monitor.check(targets[envAtStart].url);
    if(state.cycleId===monitor.latestCycle){checking=false;$('refreshButton').classList.remove('loading')}
    if(envAtStart===selected&&state.cycleId===monitor.latestCycle) render(state);
  }
  function selectEnv(env){
    if(!targets[env]||env===selected)return;
    selected=env;lastState=null;rawState=null;
    window.OcreMatrix?.setTelemetry(targets[env].label,null);
    document.querySelectorAll('.env').forEach(b=>b.classList.toggle('active',b.dataset.env===env));
    check();
  }
  document.querySelectorAll('.env').forEach(b=>b.addEventListener('click',()=>selectEnv(b.dataset.env)));
  $('refreshButton').addEventListener('click',check);
  $('matrixToggle').addEventListener('click',()=>window.OcreMatrix?.enter(targets[selected].label,lastState));
  $('matrixExit').addEventListener('click',()=>window.OcreMatrix?.exit());
  document.addEventListener('keydown',(e)=>{if(e.key==='Escape')window.OcreMatrix?.exit()});
  check();
  timer=setInterval(check,10000);
  // Si el sondeo se detiene, la muestra envejece sola y pasa a OBSOLETO sin intervención.
  const expiry=setInterval(()=>{if(rawState&&!checking){const next=applyStaleness(rawState);if(next.stale&&!(lastState&&lastState.stale))render(rawState);}},1000);
  window.addEventListener('beforeunload',()=>{clearInterval(timer);clearInterval(expiry);clearTimeout(orbCycleTimer)});
})();