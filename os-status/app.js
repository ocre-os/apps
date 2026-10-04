(() => {
  const { StatusMonitor } = window.OcreStatus;
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
  const $ = (id) => document.getElementById(id);

  function statusText(value){return ({healthy:'OPERATIVO',degraded:'DEGRADADO',failed:'FALLA',unknown:'DESCONOCIDO'})[value] || 'DESCONOCIDO'}
  function message(state){
    if(state.overall==='healthy') return 'Los puntos críticos observables responden correctamente.';
    if(state.overall==='degraded') return 'OCRE-OS responde, pero uno o más servicios secundarios requieren atención.';
    if(state.overall==='failed') return 'Hay una interrupción crítica que puede impedir el acceso normal a OCRE-OS.';
    return 'No existe evidencia suficiente para confirmar el estado completo del entorno.';
  }
  function formatTime(iso){if(!iso)return '—';return new Intl.DateTimeFormat('es-MX',{hour:'2-digit',minute:'2-digit',second:'2-digit'}).format(new Date(iso))}
  function renderChecks(state){
    $('checksGrid').innerHTML = Object.entries(checkMeta).map(([key,[name,desc]])=>{
      const value=state.checks[key]||'unknown';
      return '<article class="check" data-status="'+value+'"><div class="check-head"><div><span class="check-label">CHECK / '+key.toUpperCase()+'</span><div class="check-name">'+name+'</div></div><span class="check-status">'+statusText(value)+'</span></div><p>'+desc+'</p></article>';
    }).join('');
  }
  function orbStates(state){
    const priority=['failed','degraded','unknown'];
    const present=new Set(Object.values(state.checks||{}));
    return priority.filter(value=>value!==state.overall&&present.has(value)).slice(0,2);
  }
  function renderOrb(state){
    const orb=$('statusOrb'),secondary=orbStates(state);
    orb.className='status-orb '+state.overall+(secondary.length?' has-secondary':'');
    orb.style.setProperty('--orb-main','var(--'+state.overall+')');
    orb.style.setProperty('--orb-alt','var(--'+(secondary[0]||state.overall)+')');
    orb.style.setProperty('--orb-alt2','var(--'+(secondary[1]||secondary[0]||state.overall)+')');
    orb.dataset.states=[state.overall,...secondary].join(' ');
  }
  function render(state){
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
  function renderChecking(){
    $('environmentName').textContent=targets[selected].label;
    $('overallLabel').textContent='COMPROBANDO';
    $('heroMessage').textContent='Consultando los puntos críticos de OCRE-OS.';
    $('statusOrb').className='status-orb checking';
    $('cycleState').textContent='Comprobación en curso…';
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
    selected=env;
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
  window.addEventListener('beforeunload',()=>clearInterval(timer));
})();