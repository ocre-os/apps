(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.OcreQuotas=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 const providers=['claude','codex','work'];
 function normalize(payload={},now=Date.now()){
  const empty=()=>({state:'unknown',remaining:null,resetsAt:null});
  const result={observedAt:null,providers:Object.fromEntries(providers.map(p=>[p,empty()]))};
  if(!payload||payload.contract!=='ocre-ai-quotas-v1')return result;
  const observed=Date.parse(payload.observed_at);
  if(!Number.isFinite(observed)||now-observed>300000||observed-now>5000)return result;
  result.observedAt=payload.observed_at;
  for(const name of providers){
   const source=payload.providers?.[name];
   if(!source||!['available','limited','exhausted','unknown'].includes(source.state))continue;
   const remaining=source.remaining_percentage;
   const reset=Date.parse(source.resets_at);
   result.providers[name]={
    state:source.state,
    remaining:Number.isFinite(remaining)&&remaining>=0&&remaining<=100?remaining:null,
    resetsAt:Number.isFinite(reset)&&reset>now?source.resets_at:null
   };
  }
  return result;
 }
 class QuotaMonitor{
  constructor({fetcher=(...args)=>fetch(...args),timeoutMs=5000}={}){
   this.fetcher=fetcher;this.timeoutMs=timeoutMs;this.cycle=0;this.controller=null;
  }
  async check(url){
   const cycle=++this.cycle;
   this.controller?.abort();const controller=new AbortController();this.controller=controller;
   const timer=setTimeout(()=>controller.abort(),this.timeoutMs);
   let state;
   try{
    const response=await this.fetcher(url,{signal:controller.signal,cache:'no-store'});
    state=response.ok?normalize(await response.json()):normalize();
   }catch{state=normalize();}finally{clearTimeout(timer);}
   return {cycle,state,latest:cycle===this.cycle};
  }
 }
 return {normalize,QuotaMonitor};
});
