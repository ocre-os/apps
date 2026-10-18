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
test('recent activity keeps only fixed kinds, valid times and hexadecimal revisions, newest first, at most five',()=>{
 const base=(i,extra={})=>({at:new Date(at-i*60000).toISOString(),kind:'deploy_ok',ref:'3d84e77a1b2c',...extra});
 const raw=[base(7),base(1,{kind:'monitor_stale',ref:null}),base(3,{kind:'texto libre'}),base(2,{at:'no-es-fecha'}),base(4,{ref:'main'}),base(5),base(6),base(8),base(9)];
 const out=D.normalize({...sample(),events:raw},at).events;
 assert.equal(out.length,5);
 assert.deepEqual(out.map((e)=>e.kind),['monitor_stale','deploy_ok','deploy_ok','deploy_ok','deploy_ok']);
 assert.equal(out[1].ref,null);                       // ref inválida (no hexadecimal) se descarta, el evento se conserva
 assert.ok(out.every((e,i)=>i===0||Date.parse(out[i-1].at)>=Date.parse(e.at)));
});
test('events never carry extra fields and a payload without events is fine',()=>{
 const out=D.normalize({...sample(),events:[{at:stamp,kind:'deploy_ok',ref:'3d84e77',secret:'x',path:'/home'}]},at).events;
 assert.deepEqual(Object.keys(out[0]).sort(),['at','kind','ref']);
 assert.deepEqual(D.normalize(sample(),at).events,[]);
 assert.deepEqual(D.normalize({...sample(),events:'x'},at).events,[]);
});
test('event wording, short revision and relative time',()=>{
 const now=at+2*3600000;
 assert.deepEqual(D.eventView({at:new Date(at+3600000).toISOString(),kind:'deploy_ok',ref:'3d84e77a1b2c'},now),{label:'Despliegue de staging · 3d84e77',tone:'healthy',when:'hace 1 h'});
 assert.equal(D.eventView({at:stamp,kind:'deploy_failed',ref:null},now).tone,'failed');
 assert.equal(D.eventView({at:stamp,kind:'monitor_stale',ref:null},now).label,'Monitor detenido');
 assert.equal(D.ago(new Date(at).toISOString(),at+20000),'hace un momento');
 assert.equal(D.ago(new Date(at).toISOString(),at+5*60000),'hace 5 min');
 assert.equal(D.ago(new Date(at).toISOString(),at+3*86400000),'hace 3 d');
});
const hoursAgo=(n)=>new Date(at-n*3600000).toISOString();
const withValidations=(...items)=>({...sample(),validations:items});
const val=(sha,result,h=1)=>({at:hoursAgo(h),sha,result});
test('validations keep only a valid time, hexadecimal revision and pass/fail',()=>{
 const out=D.normalize(withValidations({...val('6a3aaf9','pass'),log:'/home/ocre/x'},val('main','pass'),val('6a3aaf9','ok'),{at:'ayer',sha:'6a3aaf9',result:'pass'}),at);
 assert.deepEqual(out.validations,[val('6a3aaf9','pass')]);
 assert.doesNotMatch(JSON.stringify(out),/home|log/);
 assert.deepEqual(D.normalize(sample(),at).validations,[]);
 assert.equal(D.normalize(withValidations(val('a1b2c3d','pass',1),val('a1b2c3e','pass',2),val('a1b2c3f','pass',3),val('a1b2c30','pass',4)),at).validations.length,3);
});
test('the deployed revision is validated, failed, or has no validation; no data is never success',()=>{
 const view=(items,sha)=>D.validationView(D.normalize(withValidations(...items),at),sha,at);
 assert.equal(view([val('6a3aaf9f35ae','pass')],'6a3aaf9').tone,'healthy');
 assert.equal(view([val('6a3aaf9','fail')],'6a3aaf9f35ae').tone,'failed');
 const other=view([val('0c43fcc','pass')],'6a3aaf9');
 assert.equal(other.tone,'neutral');assert.equal(other.label,'Sin validar');assert.match(other.text,/6a3aaf9.*no tiene validación/);
 assert.equal(view([],'6a3aaf9').label,'Sin señal');
 assert.equal(D.validationView(D.normalize(),'6a3aaf9',at).label,'Sin señal');
 assert.equal(view([val('0c43fcc','pass')],null).tone,'neutral');
});
test('only a failed validation of the deployed revision asks for attention',()=>{
 const state=(items)=>D.normalize(withValidations(...items),at);
 assert.equal(D.validationIssues(state([val('6a3aaf9','fail')]),'6a3aaf9',at).length,1);
 assert.equal(D.validationIssues(state([val('0c43fcc','fail')]),'6a3aaf9',at).length,0);
 assert.equal(D.validationIssues(state([val('6a3aaf9','pass')]),'6a3aaf9',at).length,0);
 assert.equal(D.validationIssues(D.normalize(),'6a3aaf9',at).length,0);
 const issues=D.validationIssues(state([val('6a3aaf9','fail')]),'6a3aaf9',at);
 const items=V.attention(null,null,null,{validationIssues:issues});
 assert.equal(items[0].domain,'Desarrollo');assert.equal(V.devView(null,null,issues).label,'Atención');
});
const sup=(extra={})=>({at:new Date(at-60000).toISOString(),phase:'F0',mode:'observe',stopped:false,valid:6,rejected:4,launched:0,...extra});
const withSupervisor=(value)=>({...sample(),supervisor:value});
test('the supervisor summary keeps only phase, mode, stop flag and bounded counts',()=>{
 assert.deepEqual(D.normalize(withSupervisor({...sup(),task:'OCRE-TASK-9'}),at).supervisor,sup());
 for(const bad of [{phase:'F9'},{mode:'turbo'},{valid:-1},{rejected:1000},{launched:'0'},{stopped:'no'},{at:'ayer'}])
  assert.equal(D.normalize(withSupervisor(sup(bad)),at).supervisor,null);
 assert.equal(D.normalize(sample(),at).supervisor,null);
 assert.doesNotMatch(JSON.stringify(D.normalize(withSupervisor({...sup(),task:'OCRE-TASK-9'}),at)),/OCRE-TASK/);
});
test('the queue view says it only observes, shows counts, and never reports health without a recent summary',()=>{
 const view=(s,now=at)=>D.supervisorView(D.normalize(withSupervisor(s),at),now);
 const ok=view(sup());
 assert.equal(ok.label,'F0 · Solo observa');assert.equal(ok.tone,'healthy');
 assert.match(ok.text,/6 con contrato válido · 4 rechazadas · 0 lanzadas/);
 assert.equal(view(sup({stopped:true})).label,'Detenida');
 assert.equal(view(sup({mode:'run',phase:'F2'})).label,'F2 · Ejecutando');
 assert.equal(view(undefined).label,'Sin señal');
 assert.equal(view(sup(),at+16*60000+1).label,'Sin señal');
 assert.equal(D.supervisorView(D.normalize(),at).label,'Sin señal');
});
