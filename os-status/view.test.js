const test=require('node:test');
const assert=require('node:assert/strict');
const V=require('./view.js');
function state(over={}){return {contractValid:true,overall:'healthy',deployment:{version:'0.1.0'},reasons:{},checks:{web:'healthy',api:'healthy',database:'healthy',schema:'healthy',worker:'healthy',media:'healthy',storage:'healthy',notifications:'healthy',pwa:'healthy'},...over};}
const agents=(c='available',x='available')=>({states:{claude:c,codex:x}});
test('no_channel_configured is neutral, not unknown',()=>{
 const s=state({checks:{...state().checks,notifications:'unknown'},reasons:{notifications:'no_channel_configured'}});
 assert.equal(V.checkView(s,'notifications').status,'not_configured');
 assert.deepEqual(V.attention(s,agents(),{state:'disabled'},{agentsChecked:true,xpressChecked:true}),[]);
 assert.match(V.platformView(s).text,/8 de 8 puntos operativos · 1 sin configurar/);
});
test('real unknown stays unknown and needs attention',()=>{
 const s=state({checks:{...state().checks,worker:'unknown'},reasons:{worker:'no_heartbeat'}});
 const items=V.attention(s,agents(),{state:'ok'},{});
 assert.equal(items.length,1);assert.equal(items[0].tone,'unknown');assert.match(items[0].text,/Aún no ha reportado/);
});
test('attention is sorted by severity and counted',()=>{
 const s=state({checks:{...state().checks,storage:'failed',pwa:'degraded'},reasons:{storage:'not_writable'}});
 const items=V.attention(s,agents(),{state:'late'},{agentsChecked:true,monitorStale:true});
 assert.deepEqual(items.map((i)=>i.tone),['failed','stale','degraded','degraded']);
 assert.equal(V.verdictText(items,s),'4 cosas piden atención.');
});
test('verdict wording',()=>{
 assert.equal(V.verdictText([],state()),'Todo en orden.');
 assert.equal(V.verdictText([{}],state()),'1 cosa pide atención.');
 assert.equal(V.verdictText([],null),'Consultando los puntos críticos.');
});
test('monitor_stale only after a check',()=>{
 assert.equal(V.attention(state(),agents('unknown','unknown'),{state:'ok'},{agentsChecked:false}).length,0);
 assert.equal(V.attention(state(),agents('unknown','unknown'),{state:'ok'},{agentsChecked:true,monitorStale:true})[0].tone,'stale');
 assert.equal(V.agentsView(agents('unknown','unknown'),true).label,'Monitor detenido');
});
test('agents and xpress summaries',()=>{
 assert.equal(V.agentsView(agents('working','waiting'),false).text,'Claude Trabajando · Codex En espera · desde staging');
 assert.equal(V.agentsView(agents('available','unknown'),false).tone,'unknown');
 assert.equal(V.xpressView({state:'disabled'}).tone,'neutral');
 assert.equal(V.xpressView({state:'reconcile'}).tone,'degraded');
 assert.equal(V.xpressView(undefined).tone,'unknown');
});
test('dev summary shows version, short sha and xpress state',()=>{
 const d=V.devView(state({deployment:{version:'0.1.0',commit:'0123456789abcdef'}}),{state:'disabled'});
 assert.match(d.text,/Versión 0\.1\.0 · 0123456 · Xpress \(staging\) no habilitado/);
 assert.equal(d.label,'Sin señales aún');
});
test('stale platform state is reported as stale',()=>{
 const s=state({overall:'stale',checks:{...state().checks,api:'stale',database:'stale',schema:'stale'}});
 assert.equal(V.platformView(s).tone,'stale');
 assert.ok(V.attention(s,agents(),{state:'ok'},{}).every((i)=>i.tone==='stale'));
});
test('no state is a checking placeholder, not an alarm',()=>{
 assert.equal(V.platformView(null).label,'Comprobando');
 assert.deepEqual(V.attention(null,agents(),{state:'ok'},{}),[]);
});
test('native not_configured (OCRE-058 F2) is neutral and explained',()=>{
 const s=state({checks:{...state().checks,pwa:'not_configured'},reasons:{pwa:'not_configured'}});
 assert.equal(V.checkView(s,'pwa').status,'not_configured');
 assert.match(V.checkView(s,'pwa').text,/no configurado/i);
 assert.deepEqual(V.attention(s,agents(),{state:'ok'},{}),[]);
 assert.match(V.platformView(s).text,/1 sin configurar/);
});

test('media atrasada explica que hay fotos o videos sin procesar',()=>{
  const s=state({overall:'degraded',checks:{...state().checks,media:'degraded'},reasons:{media:'backlog'}});
  assert.match(V.checkView(s,'media').text,/fotos o videos/);
  assert.equal(V.checkView(s,'worker').text,'');
});

test('un entorno que no informa media se muestra neutral con su motivo',()=>{
  const s=state({checks:{...state().checks,media:'not_configured'},reasons:{media:'not_reported'}});
  assert.equal(V.checkView(s,'media').status,'not_configured');
  assert.match(V.checkView(s,'media').text,/aún no informa/);
});
