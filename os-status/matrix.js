(() => {
  const canvas=document.getElementById('matrixCanvas'),ctx=canvas.getContext('2d');
  const panel=document.getElementById('matrixMode');
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const glyphs='0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜﾝ¦:<>+=*';
  let columns=[],raf=0,running=false,last=0,telemetry=[],environment='CORE',state=null;

  function resize(){
    const dpr=Math.min(devicePixelRatio||1,2),w=innerWidth,h=innerHeight;
    canvas.width=w*dpr;canvas.height=h*dpr;canvas.style.width=w+'px';canvas.style.height=h+'px';
    ctx.setTransform(dpr,0,0,dpr,0,0);
    // Sparse overlapping depths: roughly two thirds of the previous stream count.
    // Each stream gets its own phase, length and speed so the rain never moves as a grid.
    columns=[
      {spacing:11,size:8,alpha:.18,speed:32,chance:.72},
      {spacing:14,size:10,alpha:.38,speed:62,chance:.78},
      {spacing:19,size:13,alpha:.64,speed:96,chance:.82},
    ].flatMap((layer,depth)=>Array.from({length:Math.ceil(w/layer.spacing)},(_,i)=>{
      if(Math.random()>layer.chance)return null;
      return {
        x:i*layer.spacing+depth*3+(Math.random()-.5)*layer.spacing*.38,
        y:Math.random()*(h*1.8)-h*.4,
        speed:layer.speed+Math.random()*78,
        len:Math.max(9,Math.floor((h/layer.size)*(.18+Math.random()*.34))),
        alpha:layer.alpha+Math.random()*.14,size:layer.size,
        gap:layer.size*(1.02+Math.random()*.12),
        mutate:Math.random()*1.8,
      };
    }).filter(Boolean));
  }
  function realFragments(){
    if(!state)return [environment+'::AWAITING_SIGNAL'];
    const c=state.checks||{},parts=[
      environment+'::'+String(state.overall||'unknown').toUpperCase(),
      'WEB::'+String(c.web||'unknown').toUpperCase(),
      'API::'+String(c.api||'unknown').toUpperCase(),
      'POSTGRES::'+String(c.database||'unknown').toUpperCase(),
      'SCHEMA::'+String(c.schema||'unknown').toUpperCase(),
      state.latencyMs==null?'LATENCY::UNKNOWN':'LATENCY::'+state.latencyMs+'ms',
      'OBSERVED::'+(state.checkedAt||'UNKNOWN'),
    ];
    if(state.deployment?.version)parts.push('VERSION::'+state.deployment.version);
    if(state.deployment?.commit)parts.push('COMMIT::'+state.deployment.commit);
    return parts;
  }
  function seedTelemetry(preservePosition=false){
    const fragments=realFragments(),h=innerHeight;
    const lanes=columns.filter(c=>c.size===10);
    const count=Math.max(fragments.length,Math.floor(innerWidth/42));
    const previous=preservePosition?telemetry:[];
    telemetry=Array.from({length:count},(_,i)=>{
      const col=lanes.length?lanes[Math.floor(i*lanes.length/count)]:columns[i%Math.max(columns.length,1)];
      const text=fragments[i%fragments.length],step=12,old=previous[i];
      return {text,x:col?.x??i*42,y:old?.y??Math.random()*Math.max(0,h-text.length*step),
        alpha:.48+Math.random()*.28,speed:col?.speed??70,step,
        revealed:reduced?text.length:Math.min(old?.revealed??(1+Math.floor(Math.random()*text.length)),text.length)};
    });
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
        ctx.font=(head?'700 ':'400 ')+col.size+'px ui-monospace,SFMono-Regular,Menlo,monospace';
        ctx.fillStyle=head?'rgba(215,255,221,'+(col.alpha*.92)+')':'rgba(48,238,82,'+(col.alpha*fade*.66)+')';
        ctx.shadowBlur=head?9:2;ctx.shadowColor='#39ff63';
        const seed=(j*17+Math.floor(col.mutate*3)+Math.floor(col.x))%glyphs.length;
        ctx.fillText(glyphs[seed],col.x,y);
      }
      // Re-enter above the viewport at a random offset. No global cycle or synchronized reset.
      if(col.y-col.len*col.gap>innerHeight){
        col.y=-col.size-Math.random()*innerHeight*.65;
        col.speed=32+Math.random()*142;
        col.len=Math.max(9,Math.floor((innerHeight/col.size)*(.18+Math.random()*.34)));
      }
    });
    ctx.shadowBlur=7;ctx.font='700 11px ui-monospace,SFMono-Regular,Menlo,monospace';
    telemetry.forEach(t=>{
      if(!reduced)t.revealed+=t.speed*dt/t.step;
      if(!reduced&&t.revealed>=t.text.length)t.y+=t.speed*dt;
      if(t.y>innerHeight+20){t.y=-t.text.length*t.step-Math.random()*80;t.text=realFragments()[(Math.random()*realFragments().length)|0];t.revealed=1}
      ctx.fillStyle='rgba(135,255,151,'+t.alpha+')';ctx.shadowColor='#60ff7b';
      for(let i=0;i<Math.min(t.text.length,Math.floor(t.revealed));i++){
        const y=t.y+i*t.step;if(y<0||y>innerHeight)continue;
        ctx.fillText(t.text[i],t.x,y);
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
