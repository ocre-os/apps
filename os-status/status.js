(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.OcreStatus = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const CRITICAL = ['web', 'api', 'database', 'schema'];
  const DEGRADABLE = ['worker', 'storage', 'notifications', 'pwa'];
  const VALID = new Set(['healthy', 'degraded', 'failed', 'unknown']);

  function cleanStatus(value) {
    return VALID.has(value) ? value : 'unknown';
  }

  function aggregateStatus(checks) {
    if (CRITICAL.some((key) => cleanStatus(checks[key]) === 'failed')) return 'failed';
    if (CRITICAL.some((key) => cleanStatus(checks[key]) === 'unknown')) return 'unknown';
    if (DEGRADABLE.some((key) => cleanStatus(checks[key]) === 'failed')) return 'degraded';
    return 'healthy';
  }

  function normalizeContract(payload = {}) {
    const source = payload && payload.contract === 'ocre-status-v1' ? payload.checks || {} : {};
    const checks = { web: 'healthy' };
    [...CRITICAL.slice(1), ...DEGRADABLE].forEach((key) => {
      checks[key] = cleanStatus(source[key]?.status);
    });
    return {
      contractValid: payload.contract === 'ocre-status-v1',
      checks,
      overall: aggregateStatus(checks),
      observedAt: payload.observed_at || null,
      deployment: payload.deployment || {},
    };
  }

  class StatusMonitor {
    constructor({ fetcher = (...args) => fetch(...args), timeoutMs = 5000 } = {}) {
      this.fetcher = fetcher;
      this.timeoutMs = timeoutMs;
      this.latestCycle = 0;
      this.controller = null;
      this.state = null;
    }

    async check(url) {
      const cycleId = ++this.latestCycle;
      if (this.controller) this.controller.abort();
      const controller = new AbortController();
      this.controller = controller;
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);
      const started = Date.now();
      let state;
      try {
        const response = await this.fetcher(url, { signal: controller.signal, cache: 'no-store' });
        if (!response.ok) {
          const checks = { web: 'healthy', api: 'unknown', database: 'unknown', schema: 'unknown' };
          state = { contractValid: false, checks, overall: 'unknown', observedAt: null, deployment: {} };
        } else {
          state = normalizeContract(await response.json());
        }
        state.latencyMs = Date.now() - started;
      } catch (_error) {
        const checks = { web: 'failed', api: 'unknown', database: 'unknown', schema: 'unknown' };
        state = { contractValid: false, checks, overall: 'failed', observedAt: null, deployment: {}, latencyMs: null };
      } finally {
        clearTimeout(timer);
      }
      state.cycleId = cycleId;
      state.checkedAt = new Date().toISOString();
      if (cycleId === this.latestCycle) this.state = state;
      return state;
    }
  }

  return { aggregateStatus, normalizeContract, StatusMonitor, CRITICAL, DEGRADABLE };
});
