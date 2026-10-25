const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');

function renderer(width=390, reduced=false) {
  const calls=[], frames=new Map(), events={}; let id=0, clears=0;
  const ctx={setTransform(){},clearRect(){clears++},fillRect(x,y){if(x===0&&y===0)calls.length=0},fillText(text,x,y){calls.push({text,x,y,color:this.fillStyle})}};
  const canvas={style:{},getContext:()=>ctx}, panel={hidden:true}, body={style:{overflow:''}};
  const math=Object.create(Math); math.random=()=>.5;
  const focusable={focus(){}};
  const sandbox={document:{body,activeElement:focusable,querySelector:()=>({inert:false}),addEventListener:(name,fn)=>events[name]=fn,getElementById:id=>id==='matrixCanvas'?canvas:id==='matrixExit'?focusable:panel},window:{},
    innerWidth:width,innerHeight:844,devicePixelRatio:2,Math:math,performance:{now:()=>0},
    matchMedia:()=>({matches:reduced,addEventListener(){}}),addEventListener:(name,fn)=>events[name]=fn,
    requestAnimationFrame:fn=>{frames.set(++id,fn);return id},cancelAnimationFrame:id=>frames.delete(id)};
  vm.runInNewContext(fs.readFileSync(__dirname+'/matrix.js','utf8'),sandbox);
  return {api:sandbox.window.OcreMatrix,calls,frames,panel,body,events,get clears(){return clears},
    draw(now){if(!frames.size)return;calls.length=0;const [key,fn]=frames.entries().next().value;frames.delete(key);fn(now)}};
}
const state={overall:'healthy',checks:{web:'healthy',api:'healthy',database:'failed',schema:'unknown'},latencyMs:123,checkedAt:'2026-10-03T12:00:00Z'};

test('telemetry is a fixed horizontal readable overlay, not vertically dragged glyphs',()=>{
  const r=renderer(390,true);r.api.enter('CORE',state);
  const real=r.calls.filter(c=>c.color==='rgba(190,255,210,1)');
  assert.ok(real.length>0);
  assert.ok(real[0].text.includes('CORE::HEALTHY'));
  assert.ok(real.every(c=>c.text.length>1),'data must be drawn as phrases, not glyph particles');
  assert.ok(real.every(c=>c.x===16));
  assert.ok(real.slice(1).every((c,i)=>c.y>real[i].y));
});
test('telemetry remains anchored and literal across frames without old-position ghosting',()=>{
  const r=renderer(390);r.api.enter('CORE',state);r.draw(40);
  const first=r.calls.filter(c=>c.color==='rgba(190,255,210,1)');
  r.draw(180);
  const second=r.calls.filter(c=>c.color==='rgba(190,255,210,1)');
  assert.equal(first.length,second.length);
  assert.deepEqual(first,second);
  assert.ok(!r.calls.some(c=>c.color?.startsWith('rgba(48,238,82,') && c.text.includes('::')));
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

test('live updates replace telemetry without character mutation',()=>{
  const r=renderer();r.api.enter('CORE',state);r.draw(40);
  r.api.setTelemetry('STAGING',{...state,overall:'failed'});r.draw(220);
  const lines=r.calls.filter(c=>c.color==='rgba(190,255,210,1)').map(c=>c.text);
  assert.ok(lines.some(t=>t.includes('STAGING::FAILED')));
  assert.ok(!lines.some(t=>t.includes('CORE::HEALTHY')));
  r.api.exit();assert.equal(r.frames.size,0);
});
test('decorative rain mutates cells independently instead of walking glyphs sequentially',()=>{
  const source=fs.readFileSync(__dirname+'/matrix.js','utf8');
  assert.ok(source.includes('function rainGlyph(col,j,now)'));
  assert.ok(source.includes('mix32(col.seed'));
  assert.ok(!source.includes('const seed=(j*17'));
});
