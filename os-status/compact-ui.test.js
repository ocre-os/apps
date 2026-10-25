const test=require('node:test');
const assert=require('node:assert/strict');
const U=require('./compact-ui.js');
test('occupation segments reflect slots and cannot become progress gauge',()=>{
 const o=U.occupancy({slotsUsed:1,capacity:2});
 assert.equal(o.text,'1/2');assert.match(o.segments,/filled/);
 assert.equal(U.occupancy({slotsUsed:5,capacity:2}).valid,false);
});
test('unknown quota and auth never imply authenticated',()=>{
 const card=U.card('claude',{slotsUsed:0,capacity:2,turnSeconds:null,quota:{state:'unknown'}},'working');
 assert.match(card,/Sin medición/);assert.match(card,/Sin señal pública/);
 assert.doesNotMatch(card,/Autenticado|speedometer|<svg|90%/);
 assert.match(card,/Trabajando/);assert.match(card,/0\/2/);
});
test('quota is represented as remaining percent only with verified number',()=>{
 assert.equal(U.quota({state:'available',remainingPercent:90}).text,'90% restante');
 assert.equal(U.quota({state:'available',remainingPercent:null}).text,'Sin medición');
 assert.equal(U.quota({state:'unknown',remainingPercent:90}).text,'Sin medición');
});
test('rendered state cannot inject HTML',()=>{
 const result=U.card('codex',{slotsUsed:0,capacity:2,quota:{}},'<img src=x>');
 assert.doesNotMatch(result,/<img/);
});
