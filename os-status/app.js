(() => {
  const { StatusMonitor, applyStaleness } = window.OcreStatus;
  const V = window.OcreView;
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
    media:['Medios de Solicitudes','Procesamiento de fotos y videos de las Solicitudes.'],
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

  function statusText(value){return ({healthy:'OPERATIVO',degraded:'DEGRADADO',failed:'FALLA',stale:'OBSOLETO',unknown:'SIN SEÑAL',not_configured:'NO CONFIGURADO'})[value] || 'SIN SEÑAL'}
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
  function formatTime(iso){if(!iso)return '—';return new Intl.DateTimeFormat('es-MX',{hour:'2-digit',minute:'2-digit',second:'2-digit'}).format(new Date(iso))}
  function renderChecks(state){
    $('checksGrid').innerHTML = Object.entries(checkMeta).map(([key,[name,desc]])=>{
      const view=V.checkView(state,key);
      return '<article class="row check" data-status="'+escapeHtml(view.status)+'"><h3>'+escapeHtml(name)+'</h3><p class="check-status">'+statusText(view.status)+'</p><p class="check-detail">'+escapeHtml(view.text||desc)+'</p></article>';
    }).join('');
  }
  let agentsInfo=null,xpressInfo=null,devenvInfo=null;
  const toneWord={healthy:'OPERATIVO',degraded:'DEGRADADO',failed:'FALLA',stale:'OBSOLETO',unknown:'SIN SEÑAL',neutral:'NO CONFIGURADO'};
  function setDomain(id,view,text){
    const tile=document.querySelector('[data-domain="'+id+'"]');
    tile.dataset.tone=view.tone;
    tile.querySelector('.domain-state').textContent=view.label;
    tile.querySelector('.domain-text').textContent=text||view.text;
  }
  function escapeHtml(value){return String(value).replace(/[&<>"']/g,(c)=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c])}
  function renderDomains(){
    const state=lastState;
    const devenvIssues=window.OcreDevenv?window.OcreDevenv.issues(devenvInfo&&devenvInfo.state):[];
    const validationIssues=window.OcreDevenv?window.OcreDevenv.validationIssues(devenvInfo&&devenvInfo.state,state&&state.deployment&&state.deployment.commit):[];
    const items=V.attention(state,agentsInfo&&agentsInfo.state,xpressInfo&&xpressInfo.state,{agentsChecked:!!(agentsInfo&&agentsInfo.checked),monitorStale:!!(agentsInfo&&agentsInfo.stale),xpressChecked:!!(xpressInfo&&xpressInfo.checked),devenvIssues,validationIssues});
    if(window.OcreDevenv){
      const view=window.OcreDevenv.validationView(devenvInfo&&devenvInfo.state,state&&state.deployment&&state.deployment.commit),card=$('validation-card');
      card.dataset.state=view.tone;card.querySelector('.agent-state').textContent=view.label;card.querySelector('.agent-detail').textContent=view.text;
    }
    if(window.OcreDevenv){
      const queue=window.OcreDevenv.supervisorView(devenvInfo&&devenvInfo.state),qcard=$('supervisor-card');
      qcard.dataset.state=queue.tone;qcard.querySelector('.agent-state').textContent=queue.label;qcard.querySelector('.agent-detail').textContent=queue.text;
    }
    const platform=V.platformView(state);
    const counts=(platform.text||'').match(/^([0-9]+) de ([0-9]+) puntos/);
    setDomain('platform',{...platform,label:counts?counts[1]+'/'+counts[2]+' · '+platform.label:platform.label});
    setDomain('agents',V.agentsView(agentsInfo&&agentsInfo.state,!!(agentsInfo&&agentsInfo.stale),devenvIssues));
    setDomain('dev',V.devView(state,xpressInfo&&xpressInfo.state,validationIssues));
    $('attentionCount').textContent=state?String(items.length):'';
    document.querySelector('.attention').dataset.empty=state&&items.length===0?'true':'false';
    $('attentionList').innerHTML=state?(items.length?items.map((i)=>'<li data-tone="'+escapeHtml(i.tone)+'"><span class="att-domain">'+escapeHtml(i.domain)+'</span><strong>'+escapeHtml(i.name)+'</strong><span>'+escapeHtml(i.text)+'</span></li>').join(''):'<li class="att-empty">Nada pendiente.</li>'):'';
    if(state&&state.overall==='healthy')$('heroMessage').textContent=V.verdictText(items,state);
  }
  $('platformMore').addEventListener('click',()=>{
    const expanded=$('checksGrid').classList.toggle('expanded');
    $('platformMore').setAttribute('aria-expanded',String(expanded));
    $('platformMore').textContent=expanded?'Mostrar menos servicios':'Mostrar todos los servicios';
  });
  $('platformDescriptions').addEventListener('click',()=>{
    const visible=$('checksGrid').classList.toggle('show-descriptions');
    $('platformDescriptions').setAttribute('aria-pressed',String(visible));
    $('platformDescriptions').textContent='Descripciones';
  });
  window.addEventListener('ocre:agents',(e)=>{agentsInfo=e.detail;renderDomains();});
  window.addEventListener('ocre:xpress',(e)=>{xpressInfo=e.detail;renderDomains();});
  window.addEventListener('ocre:devenv',(e)=>{devenvInfo=e.detail;renderDomains();});
  document.querySelectorAll('.domain').forEach((tile)=>tile.addEventListener('click',()=>{
    const target=$('det-'+tile.dataset.domain);target.open=true;target.scrollIntoView({behavior:'smooth',block:'start'});
  }));
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
  function renderLiveBadge(state){
    const badge=$('livePulse');
    const status=window.OcreStatus.freshnessBadge(state);
    if(badge.dataset.state!==status){
      badge.dataset.state=status;
      badge.querySelector('.live-text').textContent=status==='current'?'Sondeo 10 s':status==='stale'?'Obsoleto':'Sin señal';
    }
  }
  function renderFreshness(state){
    renderLiveBadge(state);
    const signal=$('livePulse').dataset.state;
    $('age').textContent=signal==='stale'?'muestra obsoleta':signal==='current'?'muestra actual':'sin señal válida';
  }
  function render(state){
    rawState=state;
    state=applyStaleness(state);
    renderFreshness(state);
    lastState=state;
    const target=targets[selected];
    $('environmentName').textContent=target.label;
    $('overallLabel').textContent=statusText(state.overall);
    $('heroMessage').textContent=message(state);
    renderOrb(state);
    $('latency').textContent=state.latencyMs==null?'—':state.latencyMs+' ms';
    $('checkedAt').textContent=formatTime(state.checkedAt);
    $('contractState').textContent=state.contractValid?'VÁLIDO':'NO DISPONIBLE';
    $('version').textContent=state.deployment?.version||'—';
    $('commit').textContent=state.deployment?.commit?'commit '+state.deployment.commit:'commit no informado';
    $('cycleState').textContent='Ciclo '+state.cycleId+' · '+formatTime(state.checkedAt);
    renderChecks(state);
    renderDomains();
    if(window.OcreMatrix) window.OcreMatrix.setTelemetry(target.label,state);
  }
  function loadingDots(){return '<span class="loading-dots" aria-label="Comprobando"><i></i><i></i><i></i></span>'}
  function renderChecking(){
    $('livePulse').dataset.state='checking';
    $('livePulse').querySelector('.live-text').textContent='Comprobando';
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
    $('attentionList').innerHTML='';
    $('attentionCount').textContent='';
    renderDomains();
  }
  async function check(){
    checking=true;$('refreshButton').classList.add('loading');
    if(!lastState)renderChecking();
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
  const expiry=setInterval(()=>{
    if(!rawState)return;
    const next=applyStaleness(rawState);
    // Update freshness even during a slow in-flight check.
    renderFreshness(next);
    if(!checking&&next.stale&&!(lastState&&lastState.stale))render(rawState);
  },1000);
  window.addEventListener('beforeunload',()=>{clearInterval(timer);clearInterval(expiry);clearTimeout(orbCycleTimer)});
})();