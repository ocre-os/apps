const test=require('node:test');
const assert=require('node:assert/strict');
const {normalize,AgentMonitor}=require('./agents.js');
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
