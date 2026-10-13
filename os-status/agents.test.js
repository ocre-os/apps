const test=require('node:test');
const assert=require('node:assert/strict');
const {normalize,AgentMonitor,normalizeCapacity}=require('./agents.js');
const stamp='2026-10-05T16:00:00Z';
function sample(){return {contract:'ocre-agents-v1',observed_at:stamp,agents:{claude:{state:'working'},codex:{state:'waiting'}}};}
test('working and waiting remain separate',()=>assert.deepEqual(normalize(sample(),Date.parse(stamp)).states,{claude:'working',codex:'waiting'}));
test('stale sample cannot stay working',()=>assert.equal(normalize(sample(),Date.parse(stamp)+31000).states.claude,'unknown'));
test('future sample is rejected',()=>assert.equal(normalize(sample(),Date.parse(stamp)-6000).states.claude,'unknown'));
test('missing source is unknown',()=>assert.equal(normalize({},Date.parse(stamp)).states.codex,'unknown'));
test('invalid state not displayed as available',()=>{const p=sample();p.agents.claude.state='idle';assert.equal(normalize(p,Date.parse(stamp)).states.claude,'unknown');});
test('per-agent obsolete time cannot revive state',()=>{const p=sample();p.agents.claude.observed_at='2026-10-05T15:00:00Z';assert.equal(normalize(p,Date.parse(stamp)).states.claude,'unknown');});
test('network failure clears old activity',async()=>{const m=new AgentMonitor({fetcher:async()=>{throw Error('offline');}});const p=await m.check('test');assert.equal(p.states.claude,'unknown');});
test('old request cannot overwrite fresh request',async()=>{
 let resolve;let calls=0;
 const m=new AgentMonitor({fetcher:()=> ++calls===1 ? new Promise(r=>resolve=r) : Promise.resolve({ok:true,json:async()=>({})})});
 const a=m.check('test');await m.check('test');resolve({ok:true,json:async()=>sample()});await a;
 assert.equal(m.latest.states.claude,'unknown');
});

test('capacity absent remains unknown for every executor',()=>{
 const result=normalize(sample(),Date.parse(stamp)).capacity;
 for(const provider of ['claude','codex','desktop_commander','github_actions'])
  assert.equal(result[provider].availability,'unknown');
});
test('capacity is independent of activity and uses explicit contract',()=>{
 const p=sample();
 p.capacity={contract:'ocre-executor-capacity-v1',executors:{
  claude:{availability:'available',reason:'none',observed_at:stamp},
  codex:{availability:'exhausted',reason:'quota',observed_at:stamp}}};
 const normalized=normalize(p,Date.parse(stamp));
 assert.equal(normalized.states.claude,'working');
 assert.equal(normalized.capacity.claude.availability,'available');
 assert.equal(normalized.capacity.codex.availability,'exhausted');
 assert.equal(normalized.capacity.github_actions.availability,'unknown');
});
test('capacity observations older than five minutes become unknown',()=>{
 const p={contract:'ocre-executor-capacity-v1',executors:{
  codex:{availability:'available',reason:'none',observed_at:stamp}}};
 assert.equal(normalizeCapacity(p,Date.parse(stamp)+300001).codex.availability,'unknown');
});
test('capacity from the future is rejected',()=>{
 const p={contract:'ocre-executor-capacity-v1',executors:{
  codex:{availability:'available',reason:'none',observed_at:stamp}}};
 assert.equal(normalizeCapacity(p,Date.parse(stamp)-5001).codex.availability,'unknown');
});
test('malformed capacity data cannot imply provider availability',()=>{
 const p={contract:'ocre-executor-capacity-v1',executors:{
  claude:{availability:'idle',reason:'bogus',observed_at:stamp},
  desktop_commander:{availability:'available',observed_at:'nonsense'}}};
 const out=normalizeCapacity(p,Date.parse(stamp));
 assert.equal(out.claude.availability,'unknown');
 assert.equal(out.desktop_commander.availability,'unknown');
});
test('missing capacity contract is never trusted',()=>{
 const p={executors:{claude:{availability:'available',observed_at:stamp}}};
 assert.equal(normalizeCapacity(p,Date.parse(stamp)).claude.availability,'unknown');
});
