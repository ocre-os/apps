const assert=require('node:assert/strict');
const {normalize,services}=require('../os-status/quotas.js');
const now=Date.parse('2026-10-12T14:00:00Z');
const timestamp=new Date(now).toISOString();
const base={contract:'ocre-resource-quotas-v1',observed_at:timestamp,services:{
 codex:{state:'limited',remaining:12,unit:'percent',resets_at:new Date(now+3600000).toISOString(),source:'cli'},
 github_actions:{state:'available',remaining:300,unit:'minutes',source:'api'}
}};
assert.equal(services.length,10);
assert.equal(normalize(base,now).services.codex.remaining,12);
assert.equal(normalize(base,now).services.github_actions.unit,'minutes');
assert.equal(normalize(base,now).services.work.state,'unknown');
assert.equal(normalize(base,now+300001).services.codex.state,'unknown');
assert.equal(normalize({...base,contract:'untrusted'},now).services.codex.state,'unknown');
assert.equal(normalize({...base,services:{codex:{state:'available',remaining:-1,unit:'percent',source:'secret'}}},now).services.codex.remaining,null);
assert.equal(normalize({...base,services:{codex:{state:'available',remaining:1,unit:'percent',source:'secret'}}},now).services.codex.source,null);
assert.equal(normalize({...base,services:{codex:{state:'available',remaining:1,unit:'percent',resets_at:new Date(now-1000).toISOString()}}},now).services.codex.resetsAt,null);
console.log('OCRE_QUOTAS_TESTS_OK');
