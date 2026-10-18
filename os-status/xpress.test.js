const test=require('node:test');
const assert=require('node:assert/strict');
const {normalize,XpressMonitor}=require('./xpress.js');
const stamp='2026-10-18T12:00:00Z';
const at=Date.parse(stamp);
function sample(extra={}){return {contract:'ocre-xpress-status-v1',observed_at:stamp,enabled:true,pending:0,claimed:0,lease_expired:0,blocked:0,acked_24h:3,oldest_pending_age_s:null,...extra};}
test('healthy queue is ok',()=>assert.equal(normalize(sample(),at).state,'ok'));
test('disabled is its own state',()=>assert.equal(normalize({contract:'ocre-xpress-status-v1',observed_at:stamp,enabled:false},at).state,'disabled'));
test('expired lease or blocked requires reconcile',()=>{assert.equal(normalize(sample({lease_expired:1}),at).state,'reconcile');assert.equal(normalize(sample({blocked:2}),at).state,'reconcile');});
test('pending older than 15 minutes is late',()=>{assert.equal(normalize(sample({pending:1,oldest_pending_age_s:901}),at).state,'late');assert.equal(normalize(sample({pending:1,oldest_pending_age_s:60}),at).state,'ok');});
test('stale, future and wrong contract are unknown',()=>{
 assert.equal(normalize(sample(),at+31000).state,'unknown');
 assert.equal(normalize(sample(),at-6000).state,'unknown');
 assert.equal(normalize({...sample(),contract:'x'},at).state,'unknown');
});
test('invalid counters are unknown, not zero',()=>{
 assert.equal(normalize(sample({pending:'1'}),at).state,'unknown');
 assert.equal(normalize(sample({pending:-1}),at).state,'unknown');
 assert.equal(normalize(sample({lease_expired:undefined}),at).state,'unknown');
 assert.equal(normalize(sample({oldest_pending_age_s:'5'}),at).state,'unknown');
});
test('only whitelisted numbers survive',()=>{
 const state=normalize(sample({pending:2,request_id:'abc',body:'secreto',extra:{a:1}}),at);
 assert.deepEqual(Object.keys(state.counts).sort(),['acked_24h','blocked','claimed','lease_expired','pending']);
 assert.doesNotMatch(JSON.stringify(state),/abc|secreto/);
});
test('network failure and http error are unknown',async()=>{
 assert.equal((await new XpressMonitor({fetcher:async()=>{throw Error('x');}}).check('u')).state,'unknown');
 assert.equal((await new XpressMonitor({fetcher:async()=>({ok:false})}).check('u')).state,'unknown');
});
