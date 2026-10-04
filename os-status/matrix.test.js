const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');

function renderer(width=390, reduced=false) {
  const calls=[], frames=new Map(), events={}; let id=0, clears=0;
  const ctx={setTransform(){},clearRect(){clears++},fillRect(){},fillText(text,x,y){calls.push({text,x,y,color:this.fillStyle})}};
  const canvas={style:{},getContext:()=>ctx}, panel={hidden:true}, body={style:{}};
  const math=Object.create(Math); math.random=()=>.5;
  const sandbox={document:{body,getElementById:id=>id==='matrixCanvas'?canvas:panel},window:{},
    innerWidth:width,innerHeight:844,devicePixelRatio:2,Math:math,performance:{now:()=>0},
    matchMedia:()=>({matches:reduced}),addEventListener:(name,fn)=>events[name]=fn,
    requestAnimationFrame:fn=>{frames.set(++id,fn);return id},cancelAnimationFrame:id=>frames.delete(id)};
  vm.runInNewContext(fs.readFileSync(__dirname+'/matrix.js','utf8'),sandbox);
  return {api:sandbox.window.OcreMatrix,calls,frames,panel,body,events,get clears(){return clears},
    draw(now){calls.length=0;const [key,fn]=frames.entries().next().value;frames.delete(key);fn(now)}};
}
const state={overall:'healthy',checks:{web:'healthy',api:'healthy',database:'failed',schema:'unknown'},latencyMs:123,checkedAt:'2026-10-03T12:00:00Z'};

test('telemetry is upright single glyphs in increasing y order, never horizontal phrases',()=>{
  const r=renderer(390,true);r.api.enter('CORE',state);r.draw(40);
  assert.ok(r.calls.every(c=>Array.from(c.text).length===1),'horizontal phrase was drawn');
  const real=r.calls.filter(c=>c.color.startsWith('rgba(174,255,185,'));
  assert.ok(real.length>0);
  const first=real.slice(0,13);
  assert.ok(['CORE::HEALTHY','C0RE::HEALTHY'].includes(first.map(c=>c.text).join('')));
  assert.ok(first.every(c=>c.x===first[0].x));
  assert.ok(first.slice(1).every((c,i)=>c.y>first[i].y));
  assert.ok(new Set(real.map(c=>c.x)).size<=5,'telemetry should remain sparse');
  assert.ok(real.some(c=>'4031058672'.includes(c.text)),'visible telemetry should contain an active lookalike mutation');
});

test('rain stays populated at the reduced cinematic density on mobile and desktop',()=>{
  for(const width of [390,1440]){
    const r=renderer(width,true);r.api.enter('CORE',state);r.draw(40);
    assert.ok(r.calls.length>width*2,`${width}: sparse first frame`);
    assert.ok(new Set(r.calls.map(c=>c.x)).size>width/8,'missing layered columns');
  }
});

test('status polling preserves the live canvas instead of flashing or reseeding the rain',()=>{
  const r=renderer();r.api.enter('CORE',state);r.draw(40);
  const clearsAfterEnter=r.clears;
  r.api.setTelemetry('CORE',{...state,latencyMs:98});r.draw(80);
  assert.equal(r.clears,clearsAfterEnter,'live telemetry update cleared the canvas');
});

test('exit cancels rendering and reduced motion does not keep scheduling frames',()=>{
  const r=renderer(390,true);r.api.enter('CORE',state);r.draw(40);
  assert.equal(r.frames.size,0);
  r.api.exit();assert.equal(r.panel.hidden,true);assert.equal(r.body.style.overflow,'');
});

test('live updates replace old telemetry and animated frames reveal downwards',()=>{
  const r=renderer();r.api.enter('CORE',state);r.draw(40);
  const before=r.calls.filter(c=>c.color.startsWith('rgba(174,255,185,')).length;
  r.draw(180);
  assert.ok(r.calls.filter(c=>c.color.startsWith('rgba(174,255,185,')).length>before);
  r.api.setTelemetry('STAGING',{...state,overall:'failed'});r.draw(220);
  assert.ok(r.calls.every(c=>Array.from(c.text).length===1));
  r.api.exit();assert.equal(r.frames.size,0);
  const still=renderer(390,true);still.api.enter('CORE',state);still.draw(40);
  still.api.setTelemetry('STAGING',{...state,overall:'failed'});still.draw(80);
  const text=still.calls.filter(c=>c.color.startsWith('rgba(174,255,185,')).map(c=>c.text).join('');
  assert.ok(text.includes('::'),'updated telemetry remains structured');assert.ok(!text.includes('CORE::HEALTHY'));
});

test('telemetry glyph mutation uses reversible visual lookalikes',()=>{
  const source=fs.readFileSync(__dirname+'/matrix.js','utf8');
  assert.ok(source.includes("const lookalikes={A:'4',E:'3',I:'1',O:'0',S:'5',B:'8',G:'6',T:'7',Z:'2'}"));
  assert.ok(source.includes('telemetryGlyph(t.text[i],i,now)'));
});
