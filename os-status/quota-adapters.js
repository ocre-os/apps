/* Pure, model-free adapters for trusted backend observations.
 * Do not ship raw provider snapshots or account metadata to public Status.
 */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.OcreQuotaAdapters=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 const finite=n=>typeof n==='number'&&Number.isFinite(n);
 const iso=seconds=>finite(seconds)&&seconds>0?new Date(seconds*1000).toISOString():null;
 function codex(snapshot,nowSeconds){
  if(!snapshot||snapshot.provider!=='codex'||!finite(snapshot.observed_at)||
     nowSeconds-snapshot.observed_at>300||snapshot.observed_at-nowSeconds>5||
     snapshot.complete!==true||!Array.isArray(snapshot.windows)||snapshot.windows.length!==2)
   return null;
  const active=snapshot.windows.filter(w=>w&&finite(w.remaining)&&w.remaining>=0&&w.remaining<=100&&
    finite(w.resets_at)&&w.resets_at>nowSeconds);
  if(active.length!==2)return null;
  const remaining=Math.min(...active.map(w=>w.remaining));
  const reset=Math.max(...active.map(w=>w.resets_at));
  const state=snapshot.blocked||remaining===0?'exhausted':remaining<=10?'limited':'available';
  return {state,remaining,unit:'percent',resets_at:iso(reset),source:'cli',
    observed_at:iso(snapshot.observed_at)};
 }
 function claude(snapshot,nowSeconds){
  if(!snapshot||snapshot.provider!=='claude'||!finite(snapshot.observed_at)||
     nowSeconds-snapshot.observed_at>300||snapshot.observed_at-nowSeconds>5||
     snapshot.complete!==true||!Array.isArray(snapshot.windows)||snapshot.windows.length!==2)return null;
  const active=snapshot.windows.filter(w=>w&&finite(w.remaining)&&w.remaining>=0&&w.remaining<=100&&
    finite(w.resets_at)&&w.resets_at>nowSeconds);
  if(active.length!==2)return null;
  const remaining=Math.min(...active.map(w=>w.remaining));
  return {state:remaining===0?'exhausted':remaining<=10?'limited':'available',
    remaining,unit:'percent',resets_at:iso(Math.max(...active.map(w=>w.resets_at))),
    source:'event',observed_at:iso(snapshot.observed_at)};
 }
 return {codex,claude};
});
