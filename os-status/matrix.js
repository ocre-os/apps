(() => {
  const canvas=document.getElementById('matrixCanvas'),ctx=canvas.getContext('2d');
  const panel=document.getElementById('matrixMode');
  const motion=matchMedia('(prefers-reduced-motion: reduce)');
  let reduced=motion.matches;
  const exitButton=document.getElementById('matrixExit'),shell=document.querySelector('.shell');
  let previousFocus=null,previousOverflow='',previousInert=false;
  const glyphs='0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜﾝ¦:<>+=*#%&?';
  const mix32=n=>{n=Math.imul(n^(n>>>16),0x45d9f3b);n=Math.imul(n^(n>>>16),0x45d9f3b);return (n^(n>>>16))>>>0};
  function rainGlyph(col,j,now){
    // Independent cell clocks + mixed hash: never walk the alphabet/string sequentially.
    const tick=Math.floor(now/(105+((col.seed+j*13)%95)));
    return glyphs[mix32(col.seed^Math.imul(j+1,0x9e3779b1)^tick)%glyphs.length];
  }
  let columns=[],raf=0,running=false,last=0,telemetry=[],environment='CORE',state=null;

  function resize(){
    const dpr=Math.min(devicePixelRatio||1,2),w=innerWidth,h=innerHeight;
    canvas.width=w*dpr;canvas.height=h*dpr;canvas.style.width=w+'px';canvas.style.height=h+'px';
    ctx.setTransform(dpr,0,0,dpr,0,0);
    // Sparse overlapping depths: roughly two thirds of the previous stream count.
    // Each stream gets its own phase, length and speed so the rain never moves as a grid.
    columns=[
      {spacing:6.83,size:15,alpha:.075,speed:18,chance:.90},
      {spacing:10.74,size:16,alpha:.18,speed:34,chance:.92},
      {spacing:21,size:17,alpha:.67,speed:96,chance:.99},
    ].flatMap((layer,depth)=>Array.from({length:Math.ceil(w/layer.spacing)},(_,i)=>{
      if(Math.random()>layer.chance)return null;
      return {
        x:i*layer.spacing+depth*3+(Math.random()-.5)*layer.spacing*.38,
        y:Math.random()*(h*1.8)-h*.4,
        speed:layer.speed+Math.random()*78,
        len:Math.max(9,Math.floor((h/layer.size)*(.18+Math.random()*.34))),
        alpha:layer.alpha+Math.random()*.14,size:layer.size,
        gap:layer.size*(1.02+Math.random()*.12),
        mutate:Math.random()*1.8,seed:(Math.random()*0xffffffff)>>>0,
      };
    }).filter(Boolean));
  }
  function realFragments(){
    if(!state)return [environment+'::AWAITING_SIGNAL'];
    const c=state.checks||{},parts=[
      environment+'::'+String(state.overall||'unknown').toUpperCase(),
      'WEB::'+String(c.web||'unknown').toUpperCase(),
      'API::'+String(c.api||'unknown').toUpperCase(),
      'DB::'+String(c.database||'unknown').toUpperCase(),
      'SCHEMA::'+String(c.schema||'unknown').toUpperCase(),
      'WORKER::'+String(c.worker||'unknown').toUpperCase(),
      'MEDIA::'+String(c.media||'unknown').toUpperCase(),
      'PWA::'+String(c.pwa||'unknown').toUpperCase(),
      state.latencyMs==null?'LATENCY::UNKNOWN':'LATENCY::'+state.latencyMs+'ms',
      'OBSERVED::'+(state.checkedAt||'UNKNOWN'),
    ];
    if(state.deployment?.version)parts.push('VERSION::'+state.deployment.version);
    if(state.deployment?.commit)parts.push('COMMIT::'+state.deployment.commit);
    return parts;
  }
  // Telemetry is an anchored, high-contrast information layer, never a rain stream.
  // It remains readable on every frame (including reduced-motion presentation).
  function seedTelemetry(){
    const fragments=realFragments(),w=innerWidth,h=innerHeight;
    const available=Math.max(1,Math.floor((h-116)/31));
    telemetry=fragments.slice(0,Math.min(available,12)).map((text,i)=>({
      text:String(text).slice(0,Math.max(15,Math.floor((w-44)/8.3))),
      x:16,y:58+i*31,
    }));
  }
  function renderTelemetry(){
    const w=innerWidth;
    ctx.shadowBlur=0;ctx.textBaseline='middle';
    ctx.font='600 13px ui-monospace,SFMono-Regular,Menlo,monospace';
    telemetry.forEach(t=>{
      // An opaque backing prevents decorative glyphs from ghosting through data.
      ctx.fillStyle='rgba(0,12,9,.96)';
      ctx.fillRect(t.x-7,t.y-4,w-2*t.x+14,27);
      ctx.fillStyle='rgba(190,255,210,1)';
      ctx.fillText(t.text,t.x,t.y+10);
    });
    ctx.textBaseline='top';
  }
  function draw(now){
    if(!running)return;
    if(!reduced&&now-last<40){raf=requestAnimationFrame(draw);return}
    const dt=Math.min((now-last||40)/1000,.1);last=now;
    // More aggressive background decay prevents heavy smearing of decorative rain.
    ctx.fillStyle='rgba(0,3,0,'+(reduced?'1':'.42')+')';ctx.fillRect(0,0,innerWidth,innerHeight);
    ctx.textBaseline='top';
    columns.forEach(col=>{
      if(!reduced){col.y+=col.speed*dt;col.mutate+=dt}
      for(let j=0;j<col.len;j++){
        const y=col.y-j*col.gap;
        if(y<-col.size||y>innerHeight+col.size)continue;
        const fade=Math.pow(1-j/col.len,1.55),head=j===0;
        ctx.font=(head?'700 ':'400 ')+col.size+'px "Matrix Code NFI",ui-monospace,SFMono-Regular,Menlo,monospace';
        ctx.fillStyle=head?'rgba(215,255,221,'+(col.alpha*.92)+')':'rgba(48,238,82,'+(col.alpha*fade*.72)+')';
        ctx.shadowBlur=head?3:0;ctx.shadowColor='#39ff63';
        ctx.fillText(rainGlyph(col,j,now),col.x,y);
      }
      // Re-enter above the viewport at a random offset. No global cycle or synchronized reset.
      if(col.y-col.len*col.gap>innerHeight){
        col.y=-col.size-Math.random()*innerHeight*.65;
        col.speed=32+Math.random()*142;
        col.len=Math.max(9,Math.floor((innerHeight/col.size)*(.18+Math.random()*.34)));
      }
    });
    renderTelemetry();
    ctx.shadowBlur=0;
    if(!reduced)raf=requestAnimationFrame(draw);
  }
  function enter(env,current){
    if(!running){
      previousFocus=document.activeElement;previousOverflow=document.body.style.overflow;
      previousInert=shell?.inert||false;
    }
    environment=env||environment;state=current||null;panel.hidden=false;document.body.style.overflow='hidden';
    if(shell)shell.inert=true;
    exitButton.focus();
    resize();seedTelemetry();ctx.clearRect(0,0,innerWidth,innerHeight);running=true;last=performance.now();cancelAnimationFrame(raf);
    if(reduced)draw(last);else raf=requestAnimationFrame(draw);
  }
  function exit(){
    if(!running)return;
    running=false;cancelAnimationFrame(raf);panel.hidden=true;
    document.body.style.overflow=previousOverflow;
    if(shell)shell.inert=previousInert;
    previousFocus?.focus();
  }
  function setTelemetry(env,current){
    const previous=state?.overall;environment=env;state=current;
    if(running){
      // Polling preserves rain positions; anchored data is immediately updated.
      seedTelemetry();
      if(previous&&previous!==current?.overall)columns.forEach(c=>{c.alpha=Math.min(.82,c.alpha+.05)});
      if(reduced)draw(performance.now());
    }
  }
  addEventListener('resize',()=>{if(running){resize();seedTelemetry();if(reduced)draw(performance.now())}});
  document.addEventListener('keydown',(event)=>{
    if(running&&event.key==='Tab'){event.preventDefault();exitButton.focus()}
  });
  motion.addEventListener('change',(event)=>{
    reduced=event.matches;
    if(!running)return;
    cancelAnimationFrame(raf);last=performance.now();
    if(reduced){seedTelemetry();draw(last)}else raf=requestAnimationFrame(draw);
  });
  window.OcreMatrix={enter,exit,setTelemetry};
})();
