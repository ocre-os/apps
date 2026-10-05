const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function setup(reduced = false) {
  const frames = new Map(), events = {}, drawn = [];
  let serial = 0;
  const ctx = {setTransform(){}, clearRect(){drawn.length=0}, fillRect(){drawn.length=0}, fillText(text){drawn.push(text)}};
  const nodes = {
    matrixCanvas: {style:{}, getContext:()=>ctx},
    matrixMode: {hidden:true},
    matrixExit: {focus(){document.activeElement=this}},
    matrixToggle: {focus(){document.activeElement=this}},
    shell: {inert:false},
  };
  const document = {
    body:{style:{overflow:'auto'}}, activeElement:nodes.matrixToggle,
    getElementById:id=>nodes[id], querySelector:()=>nodes.shell,
    addEventListener:(name, callback)=>{events[name]=callback},
  };
  const preference = {matches:reduced, addEventListener:(name,callback)=>{events.motion=callback}};
  const math=Object.create(Math);math.random=()=>.5;
  const sandbox = {document, window:{}, Math:math, innerWidth:390, innerHeight:844, devicePixelRatio:2,
    matchMedia:()=>preference, performance:{now:()=>0},
    requestAnimationFrame:callback=>{const id=++serial;frames.set(id,callback);return id},
    cancelAnimationFrame:id=>frames.delete(id), addEventListener:(name,callback)=>{events[name]=callback},
  };
  vm.runInNewContext(fs.readFileSync(__dirname+'/matrix.js','utf8'),sandbox);
  return {api:sandbox.window.OcreMatrix,frames,drawn,nodes,document,events,preference,sandbox,
    frame(now=16){const [id,cb]=frames.entries().next().value;frames.delete(id);cb(now)}};
}
const state = {overall:'healthy', checks:{web:'healthy',api:'healthy',database:'healthy',schema:'healthy'}, latencyMs:42,checkedAt:'2026-10-05T00:00:00Z'};

test('reduced motion paints once, updates real telemetry, and schedules no animation',()=>{
  const s=setup(true);s.api.enter('CORE',state);
  assert.equal(s.frames.size,0);
  assert.ok(s.drawn.join('').includes('CORE::HEALTHY'));
  s.api.setTelemetry('STAGING',{...state,overall:'failed'});
  assert.ok(s.drawn.join('').includes('STAGING::FAILED'));
  assert.equal(s.frames.size,0);
});

test('enter focuses exit, isolates underlying UI and exit restores focus and scrolling',()=>{
  const s=setup();s.api.enter('CORE',state);
  assert.equal(s.document.activeElement,s.nodes.matrixExit);
  assert.equal(s.nodes.shell.inert,true);
  let prevented=false;s.events.keydown({key:'Tab',preventDefault(){prevented=true}});
  assert.equal(prevented,true);
  s.api.exit();
  assert.equal(s.document.activeElement,s.nodes.matrixToggle);
  assert.equal(s.document.body.style.overflow,'auto');
  assert.equal(s.nodes.shell.inert,false);
  assert.equal(s.nodes.matrixMode.hidden,true);
  assert.equal(s.frames.size,0);
});

test('new environment without evidence never reuses prior telemetry',()=>{
  const s=setup(true);s.api.enter('CORE',state);s.api.exit();
  s.api.enter('STAGING',null);
  assert.ok(s.drawn.join('').includes('STAGING::AWAITING_SIGNAL'));
  assert.equal(s.drawn.join('').includes('API::HEALTHY'),false);
});

test('runtime preference change stops continuous animation and can resume it',()=>{
  const s=setup();s.api.enter('CORE',state);s.frame();
  assert.equal(s.frames.size,1);
  s.preference.matches=true;s.events.motion({matches:true});
  assert.equal(s.frames.size,0);
  s.preference.matches=false;s.events.motion({matches:false});
  assert.equal(s.frames.size,1);
  for(let i=0;i<600;i++)s.frame(16*i);
  assert.equal(s.frames.size,1);
  s.sandbox.innerWidth=844;s.sandbox.innerHeight=390;s.events.resize();
  assert.equal(s.nodes.matrixCanvas.width,1688);
  assert.equal(s.nodes.matrixCanvas.height,780);
  s.api.exit();assert.equal(s.frames.size,0);
});

test('switching to static presentation brings offscreen telemetry back into view',()=>{
  const s=setup();s.api.enter('CORE',state);
  for(let i=0;i<600;i++)s.frame(40*i);
  s.preference.matches=true;s.events.motion({matches:true});
  assert.equal(s.frames.size,0);
  assert.ok(s.drawn.join('').includes('CORE::HEALTHY'));
  s.api.setTelemetry('CORE',{...state,overall:'failed'});
  assert.ok(s.drawn.join('').includes('CORE::FAILED'));
});
