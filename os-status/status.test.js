const test = require('node:test');
const assert = require('node:assert/strict');
const {
  aggregateStatus,
  normalizeContract,
  StatusMonitor,
} = require('./status.js');

test('critical failure makes overall failed', () => {
  assert.equal(aggregateStatus({web:'healthy',api:'healthy',database:'failed',schema:'healthy'}), 'failed');
});

test('degradable failure makes overall degraded', () => {
  assert.equal(aggregateStatus({web:'healthy',api:'healthy',database:'healthy',schema:'healthy',worker:'failed'}), 'degraded');
});

test('unknown critical makes overall unknown', () => {
  assert.equal(aggregateStatus({web:'healthy',api:'healthy',database:'healthy',schema:'unknown'}), 'unknown');
});

test('partial contract keeps missing checks unknown', () => {
  const state = normalizeContract({contract:'ocre-status-v1', checks:{api:{status:'healthy'}}});
  assert.equal(state.checks.api, 'healthy');
  assert.equal(state.checks.database, 'unknown');
  assert.equal(state.checks.schema, 'unknown');
});

test('older cycle cannot replace newer result', async () => {
  let resolveOld;
  const payload = {contract:'ocre-status-v1',checks:{api:{status:'healthy'},database:{status:'healthy'},schema:{status:'healthy'}}};
  const fetcher = (url, {signal}) => {
    if (url.includes('new.test')) return Promise.resolve({ok:true,json:async()=>payload});
    return new Promise((resolve, reject) => {
      resolveOld = () => resolve({ok:true,json:async()=>payload});
      signal.addEventListener('abort', () => reject(new DOMException('aborted','AbortError')));
    });
  };
  const monitor = new StatusMonitor({fetcher, timeoutMs:1000});
  const old = monitor.check('https://old.test');
  const fresh = monitor.check('https://new.test');
  resolveOld();
  await Promise.allSettled([old, fresh]);
  assert.equal(monitor.latestCycle, 2);
  assert.equal(monitor.state.cycleId, 2);
});


test('reachable proxy with unavailable API keeps web healthy', async () => {
  const fetcher = async () => ({ok:false,status:503,json:async()=>({detail:'status_unavailable'})});
  const monitor = new StatusMonitor({fetcher, timeoutMs:1000});
  const state = await monitor.check('https://status.test');

  assert.equal(state.checks.web, 'healthy');
  assert.equal(state.checks.api, 'unknown');
  assert.equal(state.overall, 'unknown');
});
