#!/usr/bin/env python3
"""PRISMA v0.6.1: Chromium test of the exact single-file published HTML.

Requires playwright and locally installed Chromium. No network or client data.
Run: python3 docs/tests/prisma-v061/test_ui.py
"""
from pathlib import Path
import re
import shutil
from playwright.sync_api import sync_playwright

root=Path(__file__).resolve().parents[3]
html=(root/'prisma/index.html').read_text(encoding='utf-8')
scripts=re.findall(r'<script>(.*?)</script>',html,flags=re.S)
assert len(scripts)==2
static=re.sub(r'<script>.*?</script>','',html,flags=re.S)

def load(page,seed=None):
    page.set_content(static)
    page.evaluate("""seed=>{
      const data={...(seed||{})};
      Object.defineProperty(window,'localStorage',{value:{
        getItem:k=>Object.hasOwn(data,k)?data[k]:null,
        setItem:(k,v)=>{data[k]=String(v)},removeItem:k=>delete data[k]
      }})
    }""",seed)
    for script in scripts:page.add_script_tag(content=script)

with sync_playwright() as pw:
    executable=shutil.which('chromium') or shutil.which('chromium-browser')
    if not executable:raise SystemExit('Chromium no disponible')
    browser=pw.chromium.launch(headless=True,executable_path=executable,args=['--no-sandbox'])
    context=browser.new_context(viewport={'width':1280,'height':900})
    page=context.new_page()
    errs=[]
    page.on('pageerror',lambda error:errs.append(str(error)))
    load(page)
    page.locator('#modeToggle').click()
    page.get_by_role('button',name='＋ Preparar comprobación').click()
    assert not page.locator('#checkAdvanced').evaluate('(e)=>e.open')
    page.locator('#fTitle').fill('Verificación reproducible')
    page.locator('#fMethod').fill('Medir sin intervenir equipos energizados')
    page.locator('#fCriteria').fill('Comparar lecturas registradas')
    page.locator('#modalForm button[type="submit"]').click()
    raw=page.evaluate('JSON.parse(localStorage.getItem("ocre_prisma_v05"))')
    assert raw['version']==5
    c=raw['analyses'][0]['checks'][-1]
    assert all(v=='desconocido' for v in c['predictions'].values())
    page.locator(f'[data-configure="{c["id"]}"]').click()
    assert page.locator('#checkAdvanced').evaluate('(e)=>e.open')
    page.locator('#fOutcomeA').fill('Se observa A')
    page.locator('#fOutcomeB').fill('Se observa B')
    page.locator('#pred_0').select_option('A')
    page.locator('#pred_1').select_option('B')
    page.locator('#pred_2').select_option('desconocido')
    page.locator('#modalForm button[type="submit"]').click()
    page.get_by_role('button',name='＋ Redactar síntesis').first.click()
    page.locator('#fConclusion').fill('Conclusión provisional sin validación automática')
    page.locator('#fLimitations').fill('Una sola observación')
    page.locator('#fUnresolved').fill('Obtener segunda medición')
    page.locator('#syn_obs_0').select_option('sustenta')
    page.locator('#modalForm button[type="submit"]').click()
    assert page.get_by_text('Documentada · fuentes vinculadas').count()==1
    syn=page.evaluate('JSON.parse(localStorage.getItem("ocre_prisma_v05")).analyses[0].syntheses[0]')
    page.locator(f'[data-corroborate="{syn["id"]}"]').click()
    for selector,value in [('#fReviewer','Revisor externo'),('#fMethod','Segunda medición'),('#fReference','Acta-001'),('#fScope','Solo un dato')]:
        page.locator(selector).fill(value)
    page.locator('#modalForm button[type="submit"]').click()
    after=page.evaluate('JSON.parse(localStorage.getItem("ocre_prisma_v05")).analyses[0].syntheses[0]')
    assert after['id']==syn['id'] and len(after['reviews'])==1
    assert page.get_by_text('Corroboración humana declarada · sin certificación').count()==1
    saved=page.evaluate('localStorage.getItem("ocre_prisma_v05")')
    page2=context.new_page();load(page2,{'ocre_prisma_v05':saved})
    assert page2.evaluate('JSON.parse(localStorage.getItem("ocre_prisma_v05")).analyses[0].syntheses[0].reviews.length')==1
    mobile=browser.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True)
    mobilepage=mobile.new_page();load(mobilepage,{'ocre_prisma_v05':saved})
    metrics=mobilepage.evaluate('({w:document.documentElement.scrollWidth,v:document.documentElement.clientWidth})')
    assert metrics['w']<=metrics['v']+4,metrics
    assert not errs,errs
    print('OK: captura progresiva, matriz parcial, revisión humana, persistencia y móvil 390px')
    browser.close()
