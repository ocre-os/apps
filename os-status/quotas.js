(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.OcreQuotas=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 const services=[
  ['chatgpt','ChatGPT','IA'],['work','ChatGPT Work','IA'],
  ['codex','Codex','IA'],['claude','Claude','IA'],
  ['github_actions','GitHub Actions','Desarrollo'],
  ['desktop_commander','Desktop Commander','Desarrollo'],
  ['openai_api','OpenAI API','API / Infraestructura'],
  ['anthropic_api','Anthropic API','API / Infraestructura'],
  ['mcp_tunnel','MCP Tunnel','API / Infraestructura'],
  ['hosting','Hosting / VPS','API / Infraestructura']
 ];
 const valid=new Set(['available','limited','exhausted','unknown']);
 const sources=new Set(['api','cli','event','admin','manual']);
 const empty=()=>({state:'unknown',remaining:null,unit:null,resetsAt:null,source:null});
 function normalize(payload={},now=Date.now()){
  const result={observedAt:null,services:Object.fromEntries(services.map(([id])=>[id,empty()]))};
  if(!payload||payload.contract!=='ocre-resource-quotas-v1')return result;
  const observed=Date.parse(payload.observed_at);
  if(!Number.isFinite(observed)||now-observed>300000||observed-now>5000)return result;
  result.observedAt=payload.observed_at;
  for(const [id] of services){
   const x=payload.services?.[id];
   if(!x||!valid.has(x.state))continue;
   const sample=Date.parse(x.observed_at||payload.observed_at);
   if(!Number.isFinite(sample)||now-sample>300000||sample-now>5000)continue;
   const remaining=x.remaining;
   const reset=Date.parse(x.resets_at);
   result.services[id]={
    state:x.state,
    remaining:typeof remaining==='number'&&Number.isFinite(remaining)&&remaining>=0?remaining:null,
    unit:['percent','minutes','requests','credits','usd'].includes(x.unit)?x.unit:null,
    resetsAt:Number.isFinite(reset)&&reset>now?x.resets_at:null,
    source:sources.has(x.source)?x.source:null
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
   return {state,latest:cycle===this.cycle};
  }
 }
 return {services,normalize,QuotaMonitor};
});
