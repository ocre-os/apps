'use strict';
// Test de regresión v0.6.2: nunca afirmar "guardado" cuando localStorage falla.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const {chromium} = require('playwright');
const path = require('node:path');
const html = fs.readFileSync(path.resolve(__dirname,'../../../prisma/index.html'),'utf8');
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
assert.equal(scripts.length,2);
const shell = html.replace(/<script>[\s\S]*?<\/script>/g,'');
async function load(page,broken){
  await page.setContent(shell,{waitUntil:'domcontentloaded'});
  await page.evaluate(isBroken=>{
    const store={};
    Object.defineProperty(window,'localStorage',{configurable:true,value:{
      getItem:k=>Object.hasOwn(store,k)?store[k]:null,
      setItem:(k,v)=>{if(isBroken)throw new DOMException('Quota exceeded','QuotaExceededError');store[k]=String(v)},
      removeItem:k=>{delete store[k]}
    }});
  },broken);
  for(const code of scripts) await page.addScriptTag({content:code});
}
async function capture(page,label){
  await page.getByRole('button',{name:'＋ Nuevo análisis'}).first().click();
  await page.locator('#fStatement').fill(label);
  await page.locator('#modalForm button[type="submit"]').click();
}
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try{
   const ctx=await browser.newContext({viewport:{width:1280,height:900},acceptDownloads:true});
   const normal=await ctx.newPage(); await load(normal,false);
   await capture(normal,'Registro con almacenamiento disponible');
   const persisted=await normal.evaluate(()=>JSON.parse(localStorage.getItem('ocre_prisma_v05')));
   assert.ok(persisted.analyses.some(a=>a.statement==='Registro con almacenamiento disponible'));
   assert.equal(await normal.locator('#storageWarning').isVisible(),false);
   assert.match(await normal.locator('#toast').innerText(),/Guardado localmente/);

   const broken=await ctx.newPage();await load(broken,true);
   await capture(broken,'Registro bajo cuota agotada');
   assert.equal(await broken.locator('#storageWarning').isVisible(),true,'aviso persistente al fallar el almacenamiento');
   const message=await broken.locator('#toast').innerText();
   assert.match(message,/No se pudo guardar/);
   assert.doesNotMatch(message,/Guardado localmente/);
   assert.equal(await broken.evaluate(()=>localStorage.getItem('ocre_prisma_v05')),null);
   const dlPromise=broken.waitForEvent('download');
   await broken.locator('#emergencyExportBtn').click();
   const download=await dlPromise;
   const backup=JSON.parse(fs.readFileSync(await download.path(),'utf8'));
   assert.ok(backup.analyses.some(a=>a.statement==='Registro bajo cuota agotada'));
   console.log('OK: guardado exitoso, fallo explícito, aviso persistente y exportación de emergencia');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});