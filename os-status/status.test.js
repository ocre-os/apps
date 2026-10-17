const test = require('node:test');
const assert = require('node:assert/strict');
const {
  aggregateStatus,
  normalizeContract,
  StatusMonitor,
  applyStaleness,
  STALE_AFTER_MS,
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

const healthyPayload = (observedAt, extra = {}) => ({
  contract: 'ocre-status-v1',
  observed_at: observedAt,
  checks: {
    api: {status: 'healthy'}, database: {status: 'healthy'}, schema: {status: 'healthy'},
    worker: {status: 'healthy'}, storage: {status: 'healthy'}, notifications: {status: 'healthy'}, pwa: {status: 'healthy'},
    ...extra,
  },
});

test('reasons are kept only as fixed lowercase codes', () => {
  const state = normalizeContract(healthyPayload('2026-10-17T12:00:00Z', {
    worker: {status: 'unknown', reason: 'no_heartbeat'},
    storage: {status: 'failed', reason: '<script>alert(1)</script>'},
  }));
  assert.deepEqual(state.reasons, {worker: 'no_heartbeat'});
});

test('degraded degradable check makes overall degraded', () => {
  assert.equal(aggregateStatus({web:'healthy',api:'healthy',database:'healthy',schema:'healthy',notifications:'degraded'}), 'degraded');
});

test('stale critical check makes overall stale, but failed still wins', () => {
  assert.equal(aggregateStatus({web:'healthy',api:'stale',database:'stale',schema:'stale'}), 'stale');
  assert.equal(aggregateStatus({web:'healthy',api:'stale',database:'failed',schema:'stale'}), 'failed');
});

test('a fresh sample is not stale; an old reception becomes stale without a new poll', () => {
  const state = normalizeContract(healthyPayload('2026-10-17T12:00:00Z'));
  state.receivedAt = 1000000;
  assert.equal(applyStaleness(state, 1000000 + 10000).overall, 'healthy');
  const aged = applyStaleness(state, 1000000 + STALE_AFTER_MS + 1);
  assert.equal(aged.overall, 'stale');
  assert.equal(aged.stale, true);
  assert.equal(aged.checks.web, 'healthy');
  assert.equal(aged.checks.api, 'stale');
  assert.equal(state.overall, 'healthy', 'the original sample is not mutated');
});

test('stale never hides an explicit failure', () => {
  const state = normalizeContract(healthyPayload('2026-10-17T12:00:00Z', {database: {status: 'failed'}}));
  state.receivedAt = 1;
  const aged = applyStaleness(state, 1 + STALE_AFTER_MS + 1);
  assert.equal(aged.checks.database, 'failed');
  assert.equal(aged.overall, 'failed');
});

test('missing or invalid observed_at is stale, not healthy', () => {
  for (const observed of [undefined, null, 'not-a-date']) {
    const state = normalizeContract({...healthyPayload('x'), observed_at: observed});
    state.receivedAt = Date.now();
    assert.equal(applyStaleness(state).overall, 'stale');
  }
});

test('unknown (no data) stays distinct from stale (old data)', async () => {
  const fetcher = async () => ({ok: false, status: 503, json: async () => ({})});
  const state = await new StatusMonitor({fetcher, timeoutMs: 1000}).check('https://status.test');
  assert.equal(state.overall, 'unknown');
  assert.notEqual(state.stale, true);
});

test('a frozen sample (same observed_at kept past the limit) is marked stale', async () => {
  let now = 5000000;
  const realNow = Date.now;
  Date.now = () => now;
  try {
    const payload = healthyPayload(new Date(now).toISOString());
    const fetcher = async () => ({ok: true, json: async () => payload});
    const monitor = new StatusMonitor({fetcher, timeoutMs: 1000});
    assert.equal((await monitor.check('https://s.test')).overall, 'healthy');
    now += 10000;
    assert.equal((await monitor.check('https://s.test')).overall, 'healthy');
    now += 20000;
    const frozen = await monitor.check('https://s.test');
    assert.equal(frozen.frozen, true);
    assert.equal(frozen.overall, 'stale');
    payload.observed_at = new Date(now).toISOString();
    assert.equal((await monitor.check('https://s.test')).overall, 'healthy');
  } finally {
    Date.now = realNow;
  }
});

test('clock skew between browser and server does not create false stale', async () => {
  const skewed = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  const fetcher = async () => ({ok: true, json: async () => healthyPayload(skewed)});
  const state = await new StatusMonitor({fetcher, timeoutMs: 1000}).check('https://s.test');
  assert.equal(state.overall, 'healthy');
});
