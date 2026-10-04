(() => {
  const canvas=document.getElementById('matrixCanvas'),ctx=canvas.getContext('2d');
  const panel=document.getElementById('matrixMode');
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
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
      {spacing:8.54,size:15,alpha:.075,speed:18,chance:.90},
      {spacing:12.35,size:16,alpha:.18,speed:34,chance:.92},
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
      'PWA::'+String(c.pwa||'unknown').toUpperCase(),
      state.latencyMs==null?'LATENCY::UNKNOWN':'LATENCY::'+state.latencyMs+'ms',
      'OBSERVED::'+(state.checkedAt||'UNKNOWN'),
    ];
    if(state.deployment?.version)parts.push('VERSION::'+state.deployment.version);
    if(state.deployment?.commit)parts.push('COMMIT::'+state.deployment.commit);
    return parts;
  }
  function seedTelemetry(preservePosition=false){
    const fragments=realFragments(),h=innerHeight;
    const lanes=columns.filter(c=>c.size===16);
    // Only a few lanes carry readable telemetry; the rest remains cinematic rain.
    const count=Math.min(fragments.length,Math.max(4,Math.floor(innerWidth/86)));
    const previous=preservePosition?telemetry:[];
    telemetry=Array.from({length:count},(_,i)=>{
      const col=lanes.length?lanes[Math.floor(i*lanes.length/count)]:columns[i%Math.max(columns.length,1)];
      const text=fragments[i%fragments.length],step=14,old=previous[i];
      return {text,x:col?.x??i*42,y:old?.y??Math.random()*Math.max(0,h-text.length*step),
        alpha:.86+Math.random()*.10,speed:30+Math.random()*10,step,
        revealed:reduced?text.length:Math.min(old?.revealed??(1+Math.floor(Math.random()*text.length)),text.length)};
    });
  }
  const lookalikes={A:'4',E:'3',I:'1',L:'|',O:'0',S:'5',B:'8',G:'6',T:'7',Z:'2',P:'¶',C:'(',D:')',H:'#',X:'×',V:'\\/'};
  function telemetryGlyph(ch,index,now){
    const alt=lookalikes[ch.toUpperCase()];
    if(!alt)return ch;
    const phase=(Math.floor(now/80)+index*7)%11;
    return phase===0||phase===1||phase===2?alt:ch;
  }
  function draw(now){
    if(!running)return;
    if(!reduced&&now-last<40){raf=requestAnimationFrame(draw);return}
    const dt=Math.min((now-last||40)/1000,.1);last=now;
    // A translucent veil leaves short phosphor trails without ever clearing the frame.
    ctx.fillStyle='rgba(0,3,0,'+(reduced?'.46':'.19')+')';ctx.fillRect(0,0,innerWidth,innerHeight);
    ctx.textBaseline='top';
    columns.forEach(col=>{
      if(!reduced){col.y+=col.speed*dt;col.mutate+=dt}
      for(let j=0;j<col.len;j++){
        const y=col.y-j*col.gap;
        if(y<-col.size||y>innerHeight+col.size)continue;
        const fade=Math.pow(1-j/col.len,1.55),head=j===0;
        ctx.font=(head?'700 ':'400 ')+col.size+'px "Matrix Code NFI",ui-monospace,SFMono-Regular,Menlo,monospace';
        ctx.fillStyle=head?'rgba(215,255,221,'+(col.alpha*.92)+')':'rgba(48,238,82,'+(col.alpha*fade*.72)+')';
        ctx.shadowBlur=head?9:2;ctx.shadowColor='#39ff63';
        ctx.fillText(rainGlyph(col,j,now),col.x,y);
      }
      // Re-enter above the viewport at a random offset. No global cycle or synchronized reset.
      if(col.y-col.len*col.gap>innerHeight){
        col.y=-col.size-Math.random()*innerHeight*.65;
        col.speed=32+Math.random()*142;
        col.len=Math.max(9,Math.floor((innerHeight/col.size)*(.18+Math.random()*.34)));
      }
    });
    ctx.shadowBlur=1;ctx.font='700 14px ui-monospace,SFMono-Regular,Menlo,monospace';
    telemetry.forEach(t=>{
      if(!reduced)t.revealed+=t.speed*dt/t.step;
      if(!reduced&&t.revealed>=t.text.length)t.y+=t.speed*dt;
      if(t.y>innerHeight+20){t.y=-t.text.length*t.step-Math.random()*80;t.text=realFragments()[(Math.random()*realFragments().length)|0];t.revealed=1}
      // Match the decorative streams: readable telemetry gets a softer phosphor tail while it descends.
      if(!reduced&&t.revealed>=t.text.length){
        const trailSteps=5;
        for(let k=trailSteps;k>=1;k--){
          const trailAlpha=t.alpha*.11*(1-k/(trailSteps+1));
          ctx.fillStyle='rgba(78,235,101,'+trailAlpha+')';ctx.shadowColor='rgba(57,255,99,.12)';
          for(let i=0;i<t.text.length;i++){
            const y=t.y+i*t.step-k*3.2;if(y<0||y>innerHeight)continue;
            ctx.fillText(telemetryGlyph(t.text[i],i,now-k*34),t.x,y);
          }
        }
      }
      ctx.fillStyle='rgba(174,255,185,'+t.alpha+')';ctx.shadowColor='rgba(96,255,123,.22)';
      for(let i=0;i<Math.min(t.text.length,Math.floor(t.revealed));i++){
        const y=t.y+i*t.step;if(y<0||y>innerHeight)continue;
        ctx.fillText(telemetryGlyph(t.text[i],i,now),t.x,y);
      }
    });
    ctx.shadowBlur=0;
    if(!reduced)raf=requestAnimationFrame(draw);
  }
  function enter(env,current){
    environment=env||environment;state=current||state;panel.hidden=false;document.body.style.overflow='hidden';
    resize();seedTelemetry();ctx.clearRect(0,0,innerWidth,innerHeight);running=true;last=performance.now();cancelAnimationFrame(raf);raf=requestAnimationFrame(draw);
  }
  function exit(){running=false;cancelAnimationFrame(raf);panel.hidden=true;document.body.style.overflow=''}
  function setTelemetry(env,current){
    const previous=state?.overall;environment=env;state=current;
    if(running){
      // Keep the existing rain and positions alive: status polling must never flash/reset Matrix.
      seedTelemetry(true);
      if(previous&&previous!==current?.overall)columns.forEach(c=>{c.alpha=Math.min(.82,c.alpha+.05)});
      if(reduced){cancelAnimationFrame(raf);raf=requestAnimationFrame(draw)}
    }
  }
  addEventListener('resize',()=>{if(running){resize();seedTelemetry();if(reduced){cancelAnimationFrame(raf);raf=requestAnimationFrame(draw)}}});
  window.OcreMatrix={enter,exit,setTelemetry};
})();
