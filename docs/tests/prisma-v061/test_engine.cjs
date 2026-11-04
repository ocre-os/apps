'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const html=fs.readFileSync(path.resolve(__dirname,'../../../prisma/index.html'),'utf8');
const scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
assert.equal(scripts.length,2,'PRISMA published HTML must embed engine and app');
const sandbox={};vm.runInNewContext(scripts[0][1],sandbox,{timeout:2000});
const E=sandbox.PrismaEngine;
const hypotheses=['a','b','c'].map(id=>({id,title:id,discarded:false}));
const a=checks=>({hypotheses,checks,observations:[]});
const c=(id,predictions,risk='bajo')=>({id,state:'pendiente',risk,effort:10,outcomeA:'Sí',outcomeB:'No',predictions});
test('contraste parcial explicita pares desconocidos',()=>{
 const s=E.score(a([]),c('parcial',{a:'A',b:'B',c:'desconocido'}));
 assert.equal(s.status,'parcial');assert.equal(s.separatedPairs,1);assert.equal(s.unknownPairs,2);
 assert.equal(E.rank(a([c('parcial',{a:'A',b:'B',c:'desconocido'})]))[0].check.id,'parcial');
});
test('no inventa distinción cuando los pares conocidos coinciden',()=>{
 const x=c('no',{a:'A',b:'A',c:'desconocido'});
 assert.equal(E.score(a([]),x).status,'incompleta');assert.equal(E.rank(a([x])).length,0);
});
test('ante empate elige menor incertidumbre',()=>{
 const partial=c('partial',{a:'A',b:'B',c:'desconocido'});
 const full=c('full',{a:'A',b:'B',c:'ambos'});
 assert.equal(E.rank(a([partial,full]))[0].check.id,'full');
});
test('riesgo alto nunca recomendado automáticamente',()=>{
 const x=c('alto',{a:'A',b:'B',c:'B'},'alto');
 assert.equal(E.score(a([]),x).status,'requiere_revision_de_seguridad');
 assert.equal(E.rank(a([x])).length,0);
});
test('síntesis documentada no confirma contenido semántico',()=>{
 const data={hypotheses:[],checks:[],observations:[{id:'o',detail:'Se detuvo'}]};
 const s={conclusion:'Nunca se detuvo',limitations:'Solo una fuente',unresolved:'Repetir',links:[{type:'observacion',id:'o',role:'sustenta'}]};
 const r=E.reviewSynthesis(data,s);
 assert.equal(r.warnings.length,0);assert.equal(r.formalStatus,'documentada');
 assert.equal(r.semanticVerified,false);assert.equal(r.corroboration,'no_comprobada');
});
test('corroboración humana queda declarada, no certificada',()=>{
 const data={hypotheses:[],checks:[],observations:[{id:'o',detail:'Dato'}]};
 const s={conclusion:'Hallazgo provisional',limitations:'Muestra única',unresolved:'Validar',links:[{type:'observacion',id:'o',role:'sustenta'}],reviews:[{reviewer:'Técnico',method:'Revisión',reference:'Folio-1',scope:'Parcial'}]};
 const r=E.reviewSynthesis(data,s);
 assert.equal(r.semanticVerified,false);assert.equal(r.corroboration,'declarada_por_persona');
});
