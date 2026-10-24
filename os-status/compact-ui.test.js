const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const D=require('./devenv.js');

test('agent summary is compact and never invents auth or Claude quota', async()=>{
 const nodes=new Map(), listeners=new Map();
 const node=id=>{if(!nodes.has(id))nodes.set(id,{innerHTML:'',textContent:'',addEventListener(){}});return nodes.get(id);};
 const now=new Date().toISOString();
 const raw={contract:'ocre-devenv-v1',observed_at:now,capacity:2,agents:{
   claude:{slots_used:1,turn_seconds:90,quota:{state:'unknown',remaining_percent:null,resets_at:null}},
   codex:{slots_used:0,turn_seconds:null,quota:{state:'available',remaining_percent:91,resets_at:null}},
 }};
 let counter=0;
 class Monitor{constructor(){this.cycle=0;} async check(){this.cycle++;return D.normalize(raw);}}
 const ctx={
   window:{
     OcreDevenv:{...D,DevenvMonitor:Monitor},
     addEventListener(k,cb){listeners.set(k,cb)},
     dispatchEvent(){},
   },
   document:{getElementById:node,addEventListener(){}},
   CustomEvent:class{constructor(type,options){this.type=type;this.detail=options.detail}},
   setInterval(){return ++counter},clearInterval(){},Date,Intl,
 };
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'devenv-ui.js'),'utf8'),ctx);
 await new Promise(resolve=>setImmediate(resolve));
 listeners.get('ocre:agents')({detail:{state:{states:{claude:'working',codex:'available'}}}});
 const html=node('loadGrid').innerHTML;
 assert.match(html,/agent-compact-row/);
 assert.doesNotMatch(html,/<svg|gauge-card|status-orb|<path/i);
 assert.match(html,/1\/2 tareas ocupadas/);
 assert.match(html,/0\/2 tareas ocupadas/);
 assert.match(html,/Trabajando/);
 assert.match(html,/Sin dato/);
 assert.match(html,/91 %/);
 assert.match(html,/Autenticación: no evaluada/);
 assert.doesNotMatch(html,/Windows OK|Autenticado/);
 listeners.get('ocre:agents')({detail:{stale:true,state:{states:{claude:'working',codex:'working'}}}});
 assert.doesNotMatch(node('loadGrid').innerHTML,/Trabajando/);
});

test('dashboard has concise service preview and collapsible legend',()=>{
 const html=fs.readFileSync(path.join(__dirname,'index.html'),'utf8');
 const css=fs.readFileSync(path.join(__dirname,'styles.css'),'utf8');
 assert.match(html,/id="showServices"/);
 assert.match(html,/id="cycleState"/);
 assert.match(html,/aria-controls="checksGrid"/);
 assert.match(html,/class="rows services-preview"/);
 assert.match(html,/class="legend-details"/);
 assert.match(css,/services-preview \.row:nth-child\(n\+5\)/);
 assert.match(html,/devenv-ui\.js\?v=20261024-ocrecompactv2/);
});

test('untrusted raw agent values are rejected before rendering; UI escapes serialized labels',()=>{
 const D=require('./devenv.js');
 const at=new Date().toISOString();
 const bad={contract:'ocre-devenv-v1',observed_at:at,capacity:2,agents:{
  claude:{slots_used:'<img src=x onerror=alert(1)>',turn_seconds:0,quota:{state:'<script>',remaining_percent:'100%'}},
  codex:{slots_used:0,turn_seconds:null,quota:{state:'available',remaining_percent:90}}
 }};
 const parsed=D.normalize(bad);
 assert.equal(parsed.agents.claude,undefined);
 assert.equal(parsed.agents.codex.slotsUsed,0);
 assert.equal(parsed.agents.codex.quota.remainingPercent,90);
});
