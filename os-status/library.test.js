const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const library=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const css=fs.readFileSync(path.join(__dirname,'../library.css'),'utf8');
test('la biblioteca conserva sus herramientas (incluida PRISMA) y sus destinos originales',()=>{
 const links=['os-status/','polimob-sync/OCRE-Polimob-Sync-Installer.cmd','limpiador-mozaik/','cizalla/','escuadra/','prisma/'];
 for(const href of links)assert.ok(library.includes('href="'+href+'"'),href);
 for(const title of ['OCRE OS Status','OCRE Polimob Sync','Limpiador Mozaik KDT','Cizalla Hidráulica Krass','Escuadra Gantry','Alineación Óptica Láser','PRISMA'])assert.ok(library.includes(title));
 assert.equal((library.match(/class="app(?: app-featured)?"/g)||[]).length,6);
 assert.ok(library.includes('class="app app-pending"'));
});
test('versions distinguish interface from actual apps',()=>{
 assert.match(library,/Biblioteca <strong>v2\.0<\/strong>/);
 assert.match(library,/v2 · interfaz/);
 for(const version of ['v0.6.5','v3','Actual','En desarrollo','Sin versión publicada']) assert.ok(library.includes(version));
});
test('mantiene las advertencias existentes y el enlace de descarga',()=>{
 assert.match(library,/download aria-label="Descargar instalador/);
 assert.match(library,/Revisión y simulación/);
 assert.match(library,/Pendiente de migrar/);
 assert.match(library,/deben revisarse antes de usarse en máquina/);
});
test('la biblioteca es responsive y conserva foco visible',()=>{
 assert.match(css,/@media\(max-width:620px\)/);
 assert.match(css,/:focus-visible/);
});
