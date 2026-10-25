const test=require('node:test');
const assert=require('node:assert/strict');
const U=require('./compact-ui.js');
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
