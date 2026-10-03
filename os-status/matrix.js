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
    const spacing=10,count=Math.ceil(w/spacing);
    columns=Array.from({length:count},(_,i)=>({x:i*spacing+Math.random()*4,y:Math.random()*(h+500),speed:55+Math.random()*180,len:18+Math.floor(Math.random()*48),alpha:.22+Math.random()*.75,size:9+Math.random()*4}));
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
    const fragments=realFragments(),w=innerWidth,h=innerHeight;
    telemetry=Array.from({length:Math.max(10,Math.floor(w/100))},(_,i)=>({text:fragments[i%fragments.length],x:Math.random()*w,y:Math.random()*h,alpha:.2+Math.random()*.6,speed:15+Math.random()*45}));
  }
  function draw(now){
    if(!running)return;
    const dt=Math.min((now-last||16)/1000,.05);last=now;
    ctx.fillStyle='rgba(0,3,0,'+(reduced?'.35':'.12')+')';ctx.fillRect(0,0,innerWidth,innerHeight);
    ctx.textBaseline='top';
    columns.forEach(col=>{
      if(!reduced)col.y+=col.speed*dt;
      for(let j=0;j<col.len;j++){
        const y=col.y-j*col.size*1.08;if(y<-30||y>innerHeight+30)continue;
        const fade=1-j/col.len,head=j===0;
        ctx.font=(head?'700 ':'400 ')+col.size+'px ui-monospace,SFMono-Regular,Menlo,monospace';
        ctx.fillStyle=head?'rgba(205,255,214,'+(col.alpha*.95)+')':'rgba(55,255,92,'+(col.alpha*fade*.72)+')';
        ctx.shadowBlur=head?12:4;ctx.shadowColor='#39ff63';
        ctx.fillText(glyphs[(Math.random()*glyphs.length)|0],col.x,y);
      }
      if(col.y-col.len*col.size>innerHeight){col.y=-Math.random()*300;col.speed=45+Math.random()*150}
    });
    ctx.shadowBlur=8;ctx.font='700 11px ui-monospace,SFMono-Regular,Menlo,monospace';
    telemetry.forEach(t=>{
      if(!reduced)t.y+=t.speed*dt;
      if(t.y>innerHeight+20){t.y=-20;t.x=Math.random()*Math.max(100,innerWidth-240);t.text=realFragments()[(Math.random()*realFragments().length)|0]}
      ctx.fillStyle='rgba(145,255,160,'+t.alpha+')';ctx.shadowColor='#60ff7b';ctx.fillText(t.text,t.x,t.y);
    });
    ctx.shadowBlur=0;
    raf=requestAnimationFrame(draw);
  }
  function enter(env,current){
    environment=env||environment;state=current||state;panel.hidden=false;document.body.style.overflow='hidden';
    resize();seedTelemetry();running=true;last=performance.now();cancelAnimationFrame(raf);raf=requestAnimationFrame(draw);
  }
  function exit(){running=false;cancelAnimationFrame(raf);panel.hidden=true;document.body.style.overflow=''}
  function setTelemetry(env,current){
    const previous=state?.overall;environment=env;state=current;
    if(running){seedTelemetry();if(previous&&previous!==current?.overall){columns.forEach(c=>{c.speed*=1.7;c.alpha=Math.min(1,c.alpha+.18)})}}
  }
  addEventListener('resize',()=>{if(running){resize();seedTelemetry()}});
  window.OcreMatrix={enter,exit,setTelemetry};
})();