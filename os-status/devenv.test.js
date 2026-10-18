const test=require('node:test');
const assert=require('node:assert/strict');
const D=require('./devenv.js');
const V=require('./view.js');
const stamp='2026-10-18T12:00:00Z';
const at=Date.parse(stamp);
const quota=(extra={})=>({state:'unknown',remaining_percent:null,resets_at:null,...extra});
function sample(claude={},codex={}){return {contract:'ocre-devenv-v1',observed_at:stamp,capacity:2,agents:{
 claude:{slots_used:1,turn_seconds:720,quota:quota(),...claude},codex:{slots_used:0,turn_seconds:null,quota:quota({state:'available',remaining_percent:63}),...codex}}};}
test('a current sample is normalized to numbers and fixed states',()=>{
 const s=D.normalize(sample(),at);
 assert.equal(s.valid,true);
 assert.deepEqual(s.agents.claude,{slotsUsed:1,capacity:2,turnSeconds:720,quota:{state:'unknown',remainingPercent:null,resetsAt:null}});
 assert.equal(s.agents.codex.quota.remainingPercent,63);
});
test('stale, future, wrong contract and empty payloads are not valid',()=>{
 assert.equal(D.normalize(sample(),at+31000).valid,false);
 assert.equal(D.normalize(sample(),at-6000).valid,false);
 assert.equal(D.normalize({...sample(),contract:'x'},at).valid,false);
 assert.equal(D.normalize({},at).valid,false);
 assert.equal(D.normalize(undefined,at).valid,false);
});
test('out-of-range or mistyped values drop that agent instead of being shown',()=>{
 const s=D.normalize(sample({slots_used:3}),at);
 assert.equal(s.agents.claude,undefined);assert.ok(s.agents.codex);
 assert.equal(D.normalize(sample({slots_used:'1'}),at).agents.claude,undefined);
 assert.equal(D.normalize(sample({turn_seconds:-4}),at).agents.claude.turnSeconds,null);
 assert.equal(D.normalize(sample({quota:quota({state:'great'})}),at).agents.claude.quota.state,'unknown');
 assert.equal(D.normalize(sample({quota:quota({remaining_percent:101})}),at).agents.claude.quota.remainingPercent,null);
});
test('only whitelisted numbers survive; nothing private is kept',()=>{
 const raw=sample({task:'OCRE-TASK-9',root:'/home/ocre/x'});
 const out=JSON.stringify(D.normalize(raw,at));
 assert.doesNotMatch(out,/OCRE-TASK|home/);
});
test('gauge geometry: empty, half and full',()=>{
 const empty=D.geometry(0,2),half=D.geometry(1,2),full=D.geometry(2,2);
 assert.equal(empty.arc,'');assert.equal(half.fraction,0.5);
 assert.deepEqual(half.needle,[80,28]);
 assert.equal(full.fraction,1);assert.match(full.arc,/^M 20 78 A 60 60 0 0 1 140 78$/);
 assert.equal(D.geometry(5,2).fraction,1);assert.equal(D.geometry(1,0).fraction,0);
});
test('load tone and label follow the occupied fraction',()=>{
 assert.equal(D.loadTone(0,2),'healthy');assert.equal(D.loadTone(1,2),'healthy');assert.equal(D.loadTone(2,2),'failed');
 assert.equal(D.loadLabel(0,2),'libre');assert.equal(D.loadLabel(1,2),'carga media');assert.equal(D.loadLabel(2,2),'carga completa');
 assert.equal(D.loadTone(3,4),'degraded');
});
test('durations are short and human',()=>{
 assert.equal(D.duration(null),'Sin turno');assert.equal(D.duration(45),'45 s');assert.equal(D.duration(720),'12 min');assert.equal(D.duration(3900),'1 h 05 min');
});
test('quota text covers every state',()=>{
 assert.deepEqual(D.quotaText({state:'available',remainingPercent:63,resetsAt:null}),{text:'Disponible · 63 %',tone:'healthy'});
 assert.equal(D.quotaText({state:'low',remainingPercent:12,resetsAt:null}).tone,'degraded');
 assert.match(D.quotaText({state:'exhausted',remainingPercent:0,resetsAt:'2026-10-18T18:01:00Z'}).text,/^Agotada · vuelve \d{2}:\d{2}$/);
 assert.deepEqual(D.quotaText({state:'unknown',remainingPercent:null,resetsAt:null}),{text:'Sin dato',tone:'neutral'});
});
test('exhausted quota and full load ask for attention; low quota does not',()=>{
 const s=D.normalize(sample({slots_used:2,turn_seconds:2520},{quota:quota({state:'exhausted',remaining_percent:0,resets_at:'2026-10-18T18:01:00Z'})}),at);
 const items=D.issues(s);
 assert.deepEqual(items.map((i)=>i.name).sort(),['Claude con carga completa','Codex sin cuota']);
 assert.match(items.find((i)=>i.agent==='claude').text,/2 de 2 tareas; el turno lleva 42 min\./);
 assert.equal(D.issues(D.normalize(sample({},{quota:quota({state:'low',remaining_percent:12})}),at)).length,0);
 assert.deepEqual(D.issues({valid:false,agents:{}}),[]);
});
test('issues feed the agents tile and the attention list',()=>{
 const s=D.normalize(sample({slots_used:2}),at);
 const issues=D.issues(s);
 const tile=V.agentsView({states:{claude:'working',codex:'available'}},false,issues);
 assert.equal(tile.tone,'degraded');assert.match(tile.text,/Claude carga completa/);
 const state={checks:{web:'healthy',api:'healthy',database:'healthy',schema:'healthy',worker:'healthy',storage:'healthy',notifications:'healthy',pwa:'healthy'},overall:'healthy',reasons:{}};
 const items=V.attention(state,{states:{claude:'working',codex:'available'}},{state:'ok'},{devenvIssues:issues});
 assert.equal(items.length,1);assert.equal(items[0].domain,'Agentes');
 assert.equal(V.agentsView({states:{claude:'working',codex:'available'}},true,issues).label,'Monitor detenido');
});
test('network failure and http errors leave no measurement',async()=>{
 assert.equal((await new D.DevenvMonitor({fetcher:async()=>{throw Error('x');}}).check('u')).valid,false);
 assert.equal((await new D.DevenvMonitor({fetcher:async()=>({ok:false})}).check('u')).valid,false);
});
