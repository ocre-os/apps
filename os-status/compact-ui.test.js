const test=require('node:test');
const assert=require('node:assert/strict');
const U=require('./compact-ui.js');
test('compact platform never hides unconfigured or unhealthy checks',()=>{
 const fs=require('node:fs');
 const path=require('node:path');
 const css=fs.readFileSync(path.join(__dirname,'compact.css'),'utf8');
 const selectors=css.match(/#checksGrid:not\(\.expanded\)[^{}]*\{display:none\}/g)||[];
 assert.equal(selectors.length,1);
 assert.match(selectors[0],/data-status=healthy/);
 assert.doesNotMatch(selectors[0],/not_configured|failed|degraded|stale|unknown/);
});

test('stale occupation and quota samples are never current telemetry',()=>{
 const now=Date.parse('2026-10-24T23:00:00Z');
 const sample={valid:true,observedAt:new Date(now-20000).toISOString(),agents:{claude:{slotsUsed:2,capacity:2,quota:{state:'available',remainingPercent:90}}}};
 assert.equal(U.currentTelemetry(sample,now),true);
 assert.equal(U.currentTelemetry({...sample,observedAt:new Date(now-30001).toISOString()},now),false);
 assert.equal(U.currentTelemetry({...sample,observedAt:'bad-date'},now),false);
 assert.equal(U.currentTelemetry({...sample,valid:false},now),false);
});
test('stale and missing execution cannot appear live in compact agent rows',()=>{
 const live={state:{states:{claude:'working',codex:'available'}},stale:false};
 assert.deepEqual(U.liveStates(live),{claude:'working',codex:'available'});
 assert.deepEqual(U.liveStates({...live,stale:true}),{claude:'unknown',codex:'unknown'});
 assert.deepEqual(U.liveStates({stale:false}),{claude:'unknown',codex:'unknown'});
 assert.deepEqual(U.liveStates(null),{claude:'unknown',codex:'unknown'});
 assert.deepEqual(U.liveStates({state:{states:{claude:'invalid',codex:'waiting'}}}),{claude:'unknown',codex:'waiting'});
});
test('execution expires without receiving a new agents event',()=>{
 const time=Date.parse('2026-10-24T23:00:00Z');
 const statuses={claude:'working',codex:'available'};
 assert.deepEqual(U.freshExecution(statuses,time,time+29999),statuses);
 assert.deepEqual(U.freshExecution(statuses,time,time+30001),{claude:'unknown',codex:'unknown'});
 assert.deepEqual(U.freshExecution(statuses,0,time),{claude:'unknown',codex:'unknown'});
 assert.deepEqual(U.freshExecution(statuses,time,time-5001),{claude:'unknown',codex:'unknown'});
});
test('agent details preserve expanded panels and keyboard focus on telemetry refresh',()=>{
 const source=require('node:fs').readFileSync(require('node:path').join(__dirname,'devenv-ui.js'),'utf8');
 assert.match(source,/querySelectorAll\('details\.agent-compact\[open\]'\)/);
 assert.match(source,/if\(expanded\.has\(el\.dataset\.agent\)\)el\.open=true/);
 assert.match(source,/querySelector\('summary'\)\?\.focus\(\)/);
 assert.match(source,/freshExecution\(agentStates,agentsObservedAt\)/);
});
test('agent numbers are labelled for assistive technologies',()=>{
 const html=U.card('codex',{slotsUsed:1,capacity:2,quota:{state:'available',remainingPercent:90}},'available');
 assert.match(html,/sr-only[^>]*>Ocupación: /);
 assert.match(html,/1\/2/);
});
test('occupation segments reflect slots and cannot become progress gauge',()=>{
 const o=U.occupancy({slotsUsed:1,capacity:2});
 assert.equal(o.text,'1/2');assert.match(o.segments,/filled/);
 assert.equal(U.occupancy({slotsUsed:5,capacity:2}).valid,false);
 const large=U.occupancy({slotsUsed:3,capacity:8});
 assert.equal(large.text,'3/8');
 assert.equal(large.segments,'');
});
test('unknown quota and auth never imply authenticated',()=>{
 const card=U.card('claude',{slotsUsed:0,capacity:2,turnSeconds:null,quota:{state:'unknown'}},'working');
 assert.match(card,/Sin medición/);assert.match(card,/Sin señal pública/);
 assert.doesNotMatch(card,/Autenticado|speedometer|<svg|90%/);
 assert.match(card,/Trabajando/);assert.match(card,/0\/2/);
});
test('quota is represented as remaining percent only with verified number',()=>{
 assert.equal(U.quota({state:'available',remainingPercent:90}).text,'90% restante');
 assert.equal(U.quota({state:'available',remainingPercent:null}).text,'Sin medición');
 assert.equal(U.quota({state:'unknown',remainingPercent:90}).text,'Sin medición');
 assert.equal(U.quota({state:'exhausted',remainingPercent:40}).text,'Sin medición');
 assert.equal(U.quota({state:'exhausted',remainingPercent:0}).text,'0% restante');
});
test('rendered state cannot inject HTML',()=>{
 const result=U.card('codex',{slotsUsed:0,capacity:2,quota:{}},'<img src=x>');
 assert.doesNotMatch(result,/<img/);
});

test('small turns show seconds and large capacity visual is bounded',()=>{
 const s=U.card('codex',{slotsUsed:3,capacity:8,turnSeconds:45,quota:{}},'working');
 assert.match(s,/45 s/);
 assert.equal((s.match(/class="filled"/g)||[]).length,0);
});

test('expired telemetry retains a complete but explicitly unknown agent row',()=>{
 const html=U.card('claude',null,'unknown');
 assert.match(html,/data-agent="claude"/);
 assert.match(html,/data-telemetry="stale"/);
 assert.match(html,/Sin telemetría reciente/);
 assert.match(html,/Sin medición de reservas/);
 assert.match(html,/Restablecimiento/);
 assert.doesNotMatch(html,/0\/2|90% restante|Autenticado/);
});
test('expanded card keeps distinct execution occupation quota reset and auth',()=>{
 const html=U.card('codex',{
  slotsUsed:1,capacity:2,turnSeconds:74,
  quota:{state:'available',remainingPercent:81,resetsAt:'2026-10-31T02:14:10Z'}
 },'working');
 for(const label of ['Estado de ejecución','Ocupación','Turno actual','Autenticación','Cuota restante','Restablecimiento']){
  assert.ok(html.includes(label),label);
 }
 assert.match(html,/1\/2/);
 assert.match(html,/81% restante/);
 assert.match(html,/1 min/);
 assert.match(html,/oct/);
 assert.match(html,/Sin señal pública/);
});
test('expand all healthy platform items displays their original description',()=>{
 const fs=require('node:fs');const path=require('node:path');
 const css=fs.readFileSync(path.join(__dirname,'compact.css'),'utf8');
 assert.match(css,/#checksGrid\.expanded \.row\.check \.check-detail\{display:block/);
});
test('stale agent rows are preserved and realtime age is labelled',()=>{
 const fs=require('node:fs');const path=require('node:path');
 const js=fs.readFileSync(path.join(__dirname,'devenv-ui.js'),'utf8');
 assert.match(js,/\['claude','codex'\]\.map/);
 assert.match(js,/Sin muestra vigente/);
 assert.match(js,/Última muestra: hace /);
});

test('quota reset already elapsed never retains a fresh-looking percentage',()=>{
 const now=Date.parse('2026-10-24T23:00:00Z');
 const q={state:'available',remainingPercent:81,resetsAt:'2026-10-24T22:59:59Z'};
 assert.equal(U.quota(q,now).tone,'unknown');
 assert.equal(U.quota(q,now).text,'Esperando nueva cuota');
 assert.equal(U.quota({...q,resetsAt:'2026-10-25T22:59:59Z'},now).percent,81);
});
test('quota reset expiry updates alert inputs without changing original sample',()=>{
 const D=require('./devenv.js');
 const now=Date.parse('2026-10-25T23:00:00Z');
 const original={valid:true,observedAt:new Date(now).toISOString(),agents:{
  codex:{slotsUsed:0,capacity:2,turnSeconds:null,quota:{state:'exhausted',remainingPercent:0,resetsAt:'2026-10-24T22:00:00Z'}},
  claude:{slotsUsed:0,capacity:2,turnSeconds:null,quota:{state:'available',remainingPercent:80,resetsAt:'2026-10-27T22:00:00Z'}}
 }};
 assert.equal(D.issues(original).length,1);
 const filtered=U.expireQuotaWindows(original,now);
 assert.equal(D.issues(filtered).length,0);
 assert.equal(filtered.agents.codex.quota.state,'unknown');
 assert.equal(filtered.agents.codex.quota.remainingPercent,null);
 assert.equal(filtered.agents.codex.quota.resetsAt,'2026-10-24T22:00:00Z');
 assert.equal(original.agents.codex.quota.state,'exhausted');
 assert.equal(filtered.agents.claude.quota.remainingPercent,80);
});
test('unparseable reset timestamp invalidates both card and attention quota',()=>{
 const D=require('./devenv.js');
 const sample={valid:true,agents:{codex:{slotsUsed:0,capacity:2,turnSeconds:null,quota:{state:'exhausted',remainingPercent:0,resetsAt:'bad-date'}}}};
 const safe=U.expireQuotaWindows(sample,Date.now());
 assert.equal(U.quota(safe.agents.codex.quota).tone,'unknown');
 assert.equal(D.issues(safe).length,0);
 assert.equal(sample.agents.codex.quota.state,'exhausted');
});
test('expired historical reset remains visible as vencido in detail',()=>{
 const past=new Date(Date.now()-60000).toISOString();
 const html=U.card('codex',{slotsUsed:0,capacity:2,turnSeconds:0,quota:{state:'unknown',remainingPercent:null,resetsAt:past}},'available');
 assert.match(html,/vencido/);
 assert.match(html,/Esperando nueva cuota/);
 assert.doesNotMatch(html,/80% restante/);
});
test('same unchanged agent HTML does not replace an expanded details subtree',()=>{
 const fs=require('node:fs');const path=require('node:path');
 const js=fs.readFileSync(path.join(__dirname,'devenv-ui.js'),'utf8');
 assert.match(js,/if\(cards!==renderedCards\)/);
 assert.match(js,/renderedCards=cards/);
 assert.match(js,/windowExpiry/);
 assert.match(js,/Última muestra: hace /);
});
