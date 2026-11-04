'use strict';
/**
 * PRISMA v0.6.1 — smoke e2e en WSL.
 * Usa Playwright de Node y su Chromium administrado (no exige el ejecutable /usr/bin/chromium).
 * Ejemplo:
 *   NODE_PATH=/home/ocre/src/ocre-os/core/frontend/node_modules \
 *   /home/ocre/.nvm/versions/node/v22.23.2/bin/node docs/tests/prisma-v061/test_ui_wsl.cjs
 */
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');

const appPath = path.resolve(__dirname, '../../../prisma/index.html');
const html = fs.readFileSync(appPath, 'utf8');
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
assert.equal(scripts.length, 2, 'El HTML debe contener motor y aplicación');
const staticHtml = html.replace(/<script>[\s\S]*?<\/script>/g, '');

async function load(page, seed = {}) {
  await page.setContent(staticHtml, {waitUntil:'domcontentloaded'});
  await page.evaluate(data => {
    const store = { ...data };
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: {
        getItem: k => Object.hasOwn(store, k) ? store[k] : null,
        setItem: (k, v) => { store[k] = String(v); },
        removeItem: k => { delete store[k]; }
      }
    });
  }, seed);
  for (const code of scripts) await page.addScriptTag({content:code});
}
async function run() {
  const browser = await chromium.launch({headless:true,args:['--no-sandbox']});
  try {
    const context = await browser.newContext({viewport:{width:1280,height:900}});
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(String(e)));
    await load(page);
    await page.locator('#modeToggle').click();
    await page.getByRole('button', {name:'＋ Preparar comprobación'}).click();
    assert.equal(await page.locator('#checkAdvanced').evaluate(e => e.open), false);
    await page.locator('#fTitle').fill('Verificación reproducible');
    await page.locator('#fMethod').fill('Medir sin intervenir equipos energizados');
    await page.locator('#fCriteria').fill('Comparar lecturas registradas');
    await page.locator('#modalForm button[type="submit"]').click();
    const data = await page.evaluate(() => JSON.parse(localStorage.getItem('ocre_prisma_v05')));
    assert.equal(data.version, 5);
    const check = data.analyses[0].checks.at(-1);
    assert.ok(Object.values(check.predictions).every(v => v === 'desconocido'));
    // Sin definiciones previas, A/B no deben poder seleccionarse como resultados realizados.
    await page.locator('[data-complete="' + check.id + '"]').click();
    assert.match(await page.locator('#outcomeLabelA').innerText(), /A — No definido/);
    assert.match(await page.locator('#outcomeLabelB').innerText(), /B — No definido/);
    assert.equal(await page.locator('#fMeasuredOutcome option[value="A"]').isDisabled(), true);
    assert.equal(await page.locator('#fMeasuredOutcome option[value="B"]').isDisabled(), true);
    assert.equal(await page.locator('#fMeasuredOutcome option[value="otro"]').isEnabled(), true);
    await page.locator('#cancelModal').click();
    await page.locator('[data-configure="' + check.id + '"]').click();
    assert.equal(await page.locator('#checkAdvanced').evaluate(e => e.open), true);
    await page.locator('#fOutcomeA').fill('Se observa A');
    await page.locator('#fOutcomeB').fill('Se observa B');
    await page.locator('#pred_0').selectOption('A');
    await page.locator('#pred_1').selectOption('B');
    await page.locator('#pred_2').selectOption('desconocido');
    await page.locator('#modalForm button[type="submit"]').click();
    // Las descripciones definidas deben mostrarse de manera explícita antes de registrar.
    await page.locator('[data-complete="' + check.id + '"]').click();
    assert.equal(await page.locator('#outcomeLabelA').innerText(), 'A — Se observa A');
    assert.equal(await page.locator('#outcomeLabelB').innerText(), 'B — Se observa B');
    assert.equal(await page.locator('#fMeasuredOutcome option[value="A"]').isEnabled(), true);
    assert.equal(await page.locator('#fMeasuredOutcome option[value="B"]').isEnabled(), true);
    await page.locator('#cancelModal').click();
    // Ejercitar específicamente el acceso desde la nueva vista enfocada.
    await page.locator('#modeToggle').click();
    const focusedComplete = page.locator('.focus-layout [data-complete]').first();
    assert.equal(await focusedComplete.count(), 1, 'La vista enfocada debe ofrecer comprobación');
    const focusedId = await focusedComplete.getAttribute('data-complete');
    const current = await page.evaluate(() => JSON.parse(localStorage.getItem('ocre_prisma_v05')));
    const focusedCheck = current.analyses.find(a => a.id === current.active).checks.find(c => c.id === focusedId);
    await focusedComplete.click();
    assert.equal(await page.locator('#outcomeLabelA').innerText(),
      focusedCheck.outcomeA ? 'A — ' + focusedCheck.outcomeA : 'A — No definido antes de la comprobación.');
    assert.equal(await page.locator('#outcomeLabelB').innerText(),
      focusedCheck.outcomeB ? 'B — ' + focusedCheck.outcomeB : 'B — No definido antes de la comprobación.');
    await page.locator('#cancelModal').click();
    await page.locator('#modeToggle').click();
    await page.getByRole('button', {name:'＋ Redactar síntesis'}).first().click();
    await page.locator('#fConclusion').fill('Conclusión provisional sin validación automática');
    await page.locator('#fLimitations').fill('Una sola observación');
    await page.locator('#fUnresolved').fill('Obtener segunda medición');
    await page.locator('#syn_obs_0').selectOption('sustenta');
    await page.locator('#modalForm button[type="submit"]').click();
    assert.equal(await page.getByText('Documentada · fuentes vinculadas').count(), 1);
    const syn = await page.evaluate(() => JSON.parse(localStorage.getItem('ocre_prisma_v05')).analyses[0].syntheses[0]);
    await page.locator('[data-corroborate="' + syn.id + '"]').click();
    for (const [selector, value] of [
      ['#fReviewer', 'Revisor externo'],
      ['#fMethod', 'Segunda medición'],
      ['#fReference', 'Acta-001'],
      ['#fScope', 'Solo un dato']
    ]) await page.locator(selector).fill(value);
    await page.locator('#modalForm button[type="submit"]').click();
    const saved = await page.evaluate(() => localStorage.getItem('ocre_prisma_v05'));
    const after = JSON.parse(saved).analyses[0].syntheses[0];
    assert.equal(after.id, syn.id);
    assert.equal(after.reviews.length, 1);
    assert.equal(await page.getByText('Corroboración humana declarada · sin certificación').count(), 1);
    const restored = await context.newPage();
    await load(restored, {'ocre_prisma_v05':saved});
    const restoredCount = await restored.evaluate(() => JSON.parse(localStorage.getItem('ocre_prisma_v05')).analyses[0].syntheses[0].reviews.length);
    assert.equal(restoredCount, 1);
    const mobileContext = await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
    const mobile = await mobileContext.newPage();
    mobile.on('pageerror', e => errors.push(String(e)));
    await load(mobile, {'ocre_prisma_v05':saved});
    const dimensions = await mobile.evaluate(() => ({scroll:document.documentElement.scrollWidth,client:document.documentElement.clientWidth}));
    assert.ok(dimensions.scroll <= dimensions.client + 4, JSON.stringify(dimensions));
    assert.deepEqual(errors, []);
    console.log('OK: Chromium WSL, A/B definidos, selección segura, vista enfocada, matriz parcial, revisión, persistencia, móvil 390px; sin errores JS');
  } finally {
    await browser.close();
  }
}
run().catch(error => { console.error(error); process.exitCode = 1; });