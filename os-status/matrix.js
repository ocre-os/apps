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
    // Three depths, seeded across the whole viewport rather than an empty sky.
    columns=[
      {spacing:7,size:8,alpha:.24,speed:35},
      {spacing:9,size:10,alpha:.48,speed:75},
      {spacing:13,size:13,alpha:.72,speed:125},
    ].flatMap((layer,depth)=>Array.from({length:Math.ceil(w/layer.spacing)},(_,i)=>({
      x:i*layer.spacing+depth*2,y:Math.random()*h,
      speed:layer.speed+Math.random()*95,len:Math.ceil(h/layer.size)+24,
      alpha:layer.alpha+Math.random()*.15,size:layer.size,
    })));
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
  function seedTelemetry(){
    const fragments=realFragments(),h=innerHeight;
    const lanes=columns.filter(c=>c.size===10);
    telemetry=Array.from({length:Math.max(fragments.length*2,Math.floor(innerWidth/24))},(_,i)=>{
      const col=lanes[Math.floor(i*lanes.length/Math.max(fragments.length*2,Math.floor(innerWidth/24)))];
      const text=fragments[i%fragments.length],step=12;
      return {text,x:col.x,y:Math.random()*Math.max(0,h-text.length*step),
        alpha:.55+Math.random()*.35,speed:col.speed,step,
        revealed:reduced?text.length:1+Math.floor(Math.random()*text.length)};
    });
  }
  function draw(now){
    if(!running)return;
    // Bound canvas work to 25fps; slow devices keep organic, time-based motion.
    if(!reduced&&now-last<40){raf=requestAnimationFrame(draw);return}
    const dt=Math.min((now-last||40)/1000,.1);last=now;
    ctx.fillStyle='rgba(0,3,0,'+(reduced?'.35':'.12')+')';ctx.fillRect(0,0,innerWidth,innerHeight);
    ctx.textBaseline='top';
    columns.forEach(col=>{
      if(!reduced)col.y+=col.speed*dt;
      for(let j=0;j<col.len;j++){
        const span=innerHeight+col.size;
        const y=((col.y-j*col.size*1.08)%span+span)%span;
        const fade=1-j/col.len,head=j===0;
        ctx.font=(head?'700 ':'400 ')+col.size+'px ui-monospace,SFMono-Regular,Menlo,monospace';
        ctx.fillStyle=head?'rgba(205,255,214,'+(col.alpha*.95)+')':'rgba(55,255,92,'+(col.alpha*fade*.72)+')';
        ctx.shadowBlur=head?12:4;ctx.shadowColor='#39ff63';
        ctx.fillText(glyphs[(Math.random()*glyphs.length)|0],col.x,y);
      }
      // Wrap each trail's cells so every layer stays populated throughout a cycle.
      if(col.y>innerHeight+col.size)col.y-=innerHeight+col.size;
    });
    ctx.shadowBlur=8;ctx.font='700 11px ui-monospace,SFMono-Regular,Menlo,monospace';
    telemetry.forEach(t=>{
      if(!reduced)t.revealed+=t.speed*dt/t.step;
      // Write a stable top-to-bottom column, then let the completed text descend.
      if(!reduced&&t.revealed>=t.text.length)t.y+=t.speed*dt;
      if(t.y>innerHeight+20){t.y=-20;t.text=realFragments()[(Math.random()*realFragments().length)|0];t.revealed=1}
      ctx.fillStyle='rgba(145,255,160,'+t.alpha+')';ctx.shadowColor='#60ff7b';
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
    if(running){seedTelemetry();ctx.clearRect(0,0,innerWidth,innerHeight);if(previous&&previous!==current?.overall){columns.forEach(c=>{c.alpha=Math.min(1,c.alpha+.08)})}if(reduced){cancelAnimationFrame(raf);raf=requestAnimationFrame(draw)}}
  }
  addEventListener('resize',()=>{if(running){resize();seedTelemetry();if(reduced){cancelAnimationFrame(raf);raf=requestAnimationFrame(draw)}}});
  window.OcreMatrix={enter,exit,setTelemetry};
})();
