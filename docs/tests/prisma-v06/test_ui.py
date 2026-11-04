#!/usr/bin/env python3
"""Smoke test PRISMA v0.6; no red, usuarios ni expedientes reales."""
import re, shutil
from pathlib import Path
from playwright.sync_api import sync_playwright

html=(Path(__file__).resolve().parents[3]/"prisma"/"index.html").read_text()
scripts=re.findall(r"<script>(.*?)</script>", html, flags=re.S)
assert len(scripts)==2
static=re.sub(r"<script>.*?</script>", "", html, flags=re.S)

def load(page,seed=None):
    page.set_content(static)
    page.evaluate("""data=>{const obj={...(data||{})};Object.defineProperty(window,"localStorage",{configurable:true,value:{
        getItem:k=>Object.hasOwn(obj,k)?obj[k]:null,
        setItem:(k,v)=>{obj[k]=String(v)},removeItem:k=>{delete obj[k]}
    }})}""", seed)
    for s in scripts:page.add_script_tag(content=s)

exe=shutil.which("chromium") or shutil.which("chromium-browser")
if not exe:raise SystemExit("Chromium requerido")
with sync_playwright() as p:
    b=p.chromium.launch(executable_path=exe,headless=True,args=["--no-sandbox"])
    try:
        page=b.new_page(viewport={"width":1440,"height":900},accept_downloads=True)
        errors=[];page.on("pageerror",lambda e:errors.append(str(e)))
        load(page)
        assert page.locator(".focus-layout").count()==1
        page.locator("#modeToggle").click()
        assert page.get_by_role("heading",name="Contraste de comprobaciones").count()==1
        page.locator("#modeToggle").click()
        page.get_by_role("button",name="＋ Nuevo análisis").click()
        page.locator("#fStatement").fill("Falla experimental <img src=x onerror=alert(1)>")
        page.locator("#modalForm button[type=submit]").click()
        assert page.locator("img[src=x]").count()==0
        assert page.evaluate('JSON.parse(localStorage.getItem("ocre_prisma_v05")).version')==5
        assert page.evaluate('JSON.parse(localStorage.getItem("ocre_prisma_v05")).analyses[0].observations.length')==0
        page.locator('[data-open="quickObservation"]').first.click()
        page.locator("#fDetail").fill("Lectura de ejemplo")
        page.locator("#modalForm button[type=submit]").click()
        assert page.locator("dialog[open]").count()==1
        page.locator("#fSource").fill("Reporte inicial")
        page.locator("#modalForm button[type=submit]").click()
        saved=page.evaluate('localStorage.getItem("ocre_prisma_v05")')
        load(page,{"ocre_prisma_v05":saved})
        assert page.evaluate('JSON.parse(localStorage.getItem("ocre_prisma_v05")).analyses[0].observations.length')==1
        with page.expect_download() as dl:page.locator("#exportBtn").click()
        assert "v0.5" in dl.value.suggested_filename
        assert not errors,errors
        mobile=b.new_page(viewport={"width":390,"height":844},is_mobile=True,has_touch=True)
        load(mobile)
        assert mobile.get_by_role("button",name="＋ Nuevo análisis").count()==1
        widths=mobile.evaluate("({a:document.documentElement.scrollWidth,b:document.documentElement.clientWidth})")
        assert widths["a"]<=widths["b"]+3,widths
        print("OK: captura, fuente, XSS, compatibilidad v0.5, móvil")
    finally:b.close()
