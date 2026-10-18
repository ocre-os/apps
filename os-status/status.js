(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.OcreStatus = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const CRITICAL = ['web', 'api', 'database', 'schema'];
  const DEGRADABLE = ['worker', 'storage', 'notifications', 'pwa'];
  // `not_configured` (OCRE-058 F2): no hay nada que medir; es neutro y nunca degrada ni cuenta como falla.
  const VALID = new Set(['healthy', 'degraded', 'failed', 'stale', 'unknown', 'not_configured']);
  const STALE_AFTER_MS = 30000;
  const FROZEN_AFTER_MS = 25000;
  const REASON_CODE = /^[a-z_]{1,40}$/;

  function cleanStatus(value) {
    return VALID.has(value) ? value : 'unknown';
  }

  function aggregateStatus(checks) {
    if (CRITICAL.some((key) => cleanStatus(checks[key]) === 'failed')) return 'failed';
    if (CRITICAL.some((key) => cleanStatus(checks[key]) === 'stale')) return 'stale';
    if (CRITICAL.some((key) => cleanStatus(checks[key]) === 'unknown')) return 'unknown';
    if (DEGRADABLE.some((key) => ['failed', 'degraded'].includes(cleanStatus(checks[key])))) return 'degraded';
    return 'healthy';
  }

  function normalizeContract(payload = {}) {
    const source = payload && payload.contract === 'ocre-status-v1' ? payload.checks || {} : {};
    const checks = { web: 'healthy' };
    const reasons = {};
    [...CRITICAL.slice(1), ...DEGRADABLE].forEach((key) => {
      checks[key] = cleanStatus(source[key]?.status);
      const reason = source[key]?.reason;
      if (typeof reason === 'string' && REASON_CODE.test(reason)) reasons[key] = reason;
    });
    return {
      contractValid: payload.contract === 'ocre-status-v1',
      checks,
      reasons,
      overall: aggregateStatus(checks),
      observedAt: payload.observed_at || null,
      deployment: payload.deployment || {},
    };
  }

  // Una muestra no es evidencia vigente si: no trae observed_at válido, el servicio devuelve la misma
  // muestra congelada (observed_at sin avanzar: caché o proceso detenido) o ya pasó STALE_AFTER_MS desde
  // que se recibió (el sondeo se detuvo). Se mide con el reloj local entre recepciones, no contra el
  // reloj del servidor, para que un reloj desfasado no genere falsas alarmas.
  function sampleIsStale(state, now = Date.now()) {
    if (!Number.isFinite(Date.parse(state.observedAt))) return true;
    if (state.frozen) return true;
    return !Number.isFinite(state.receivedAt) || now - state.receivedAt > STALE_AFTER_MS;
  }

  // Devuelve el estado con la regla de obsolescencia aplicada; no muta el original. `web` conserva su
  // valor porque lo prueba la propia respuesta HTTP, y un `failed` explícito nunca se oculta.
  function applyStaleness(state, now = Date.now()) {
    if (!state || !state.contractValid || !sampleIsStale(state, now)) return state;
    const checks = { ...state.checks };
    Object.keys(checks).forEach((key) => {
      if (key !== 'web' && checks[key] !== 'failed') checks[key] = 'stale';
    });
    return { ...state, checks, overall: aggregateStatus(checks), stale: true };
  }

  class StatusMonitor {
    constructor({ fetcher = (...args) => fetch(...args), timeoutMs = 5000 } = {}) {
      this.fetcher = fetcher;
      this.timeoutMs = timeoutMs;
      this.latestCycle = 0;
      this.controller = null;
      this.state = null;
      this.seen = null;
      this.stable = null;
      this.degradedStreak = 0;
    }

    // Suavizado (OCRE-058 F2): pasar de operativo a degradado exige dos muestras consecutivas; una falla crítica, un estado
    // obsoleto o un contrato inválido se muestran de inmediato.
    smooth(state) {
      if (state.overall === 'degraded') {
        this.degradedStreak += 1;
        if (this.degradedStreak < 2 && this.stable && this.stable.overall === 'healthy') {
          return { ...this.stable, observedAt: state.observedAt, receivedAt: state.receivedAt, held: true };
        }
        return state;
      }
      this.degradedStreak = 0;
      if (state.overall === 'healthy') this.stable = state;
      return state;
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
          state = { contractValid: false, checks, reasons: {}, overall: 'unknown', observedAt: null, deployment: {} };
        } else {
          state = normalizeContract(await response.json());
          state.receivedAt = Date.now();
          const seen = this.seen;
          if (seen && seen.url === url && seen.observedAt === state.observedAt) {
            state.frozen = state.receivedAt - seen.firstSeenAt > FROZEN_AFTER_MS;
          } else {
            this.seen = { url, observedAt: state.observedAt, firstSeenAt: state.receivedAt };
          }
          state = applyStaleness(state);
          if (state.contractValid) state = this.smooth(state);
        }
        state.latencyMs = Date.now() - started;
      } catch (_error) {
        const checks = { web: 'failed', api: 'unknown', database: 'unknown', schema: 'unknown' };
        state = { contractValid: false, checks, reasons: {}, overall: 'failed', observedAt: null, deployment: {}, latencyMs: null };
      } finally {
        clearTimeout(timer);
      }
      state.cycleId = cycleId;
      state.checkedAt = new Date().toISOString();
      if (cycleId === this.latestCycle) this.state = state;
      return state;
    }
  }

  return { aggregateStatus, normalizeContract, sampleIsStale, applyStaleness, StatusMonitor, CRITICAL, DEGRADABLE, STALE_AFTER_MS };
});
