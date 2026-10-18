(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports) module.exports=api;
 else root.OcreXpress=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 // OCRE-056 punto 6: solo contadores numéricos de la ruta de metadatos; nada más del payload se conserva.
 const FIELDS=['pending','claimed','lease_expired','blocked','acked_24h'];
 const LATE_AFTER_S=900;
 function count(value){return Number.isSafeInteger(value)&&value>=0?value:null;}
 function normalize(payload={},now=Date.now()){
  const unknown={state:'unknown',counts:{},oldestPendingAge:null,observedAt:null};
  const time=Date.parse(payload.observed_at);
  if(payload.contract!=='ocre-xpress-status-v1'||!Number.isFinite(time)||now-time>30000||now-time< -5000)return unknown;
  if(payload.enabled===false)return {...unknown,state:'disabled',observedAt:payload.observed_at};
  if(payload.enabled!==true)return unknown;
  const counts={};
  for(const key of FIELDS){counts[key]=count(payload[key]);if(counts[key]===null)return unknown;}
  const age=payload.oldest_pending_age_s===null?null:count(payload.oldest_pending_age_s);
  if(payload.oldest_pending_age_s!==null&&age===null)return unknown;
  const state=counts.lease_expired>0||counts.blocked>0?'reconcile':age!==null&&age>LATE_AFTER_S?'late':'ok';
  return {state,counts,oldestPendingAge:age,observedAt:payload.observed_at};
 }
 class XpressMonitor{
  constructor({fetcher=(...args)=>fetch(...args),timeoutMs=5000}={}){this.fetcher=fetcher;this.timeoutMs=timeoutMs;this.cycle=0;this.controller=null;this.latest=normalize();}
  async check(url){
   const cycle=++this.cycle;
   this.controller?.abort();const controller=new AbortController();this.controller=controller;
   const timer=setTimeout(()=>controller.abort(),this.timeoutMs);
   let state;
   try{const response=await this.fetcher(url,{signal:controller.signal,cache:'no-store'});state=response.ok?normalize(await response.json()):normalize();}
   catch{state=normalize();}finally{clearTimeout(timer);}
   if(cycle===this.cycle)this.latest=state;
   return state;
  }
 }
 return {normalize,XpressMonitor,LATE_AFTER_S};
});
