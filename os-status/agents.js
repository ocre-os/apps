(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports) module.exports=api;
 else root.OcreAgents=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 const states=new Set(['working','waiting','available','unknown']);
 function normalize(payload={},now=Date.now()){
  const result={states:{claude:'unknown',codex:'unknown'},observedAt:null,reasons:{}};
  const time=Date.parse(payload.observed_at);
  if(payload.contract!=='ocre-agents-v1'||!Number.isFinite(time)||now-time>30000||now-time< -5000)return result;
  result.observedAt=payload.observed_at;
  for(const name of ['claude','codex']){
   const agent=payload.agents?.[name];
   if(agent?.observed_at&&Date.parse(agent.observed_at)!==time)continue;
   result.states[name]=states.has(agent?.state)?agent.state:'unknown';
   if(result.states[name]==='waiting'&&['waiting_input','waiting_approval'].includes(agent.reason))result.reasons[name]=agent.reason;
  }
  return result;
 }
 class AgentMonitor{
  constructor({fetcher=(...args)=>fetch(...args),timeoutMs=5000}={}){
   this.fetcher=fetcher;this.timeoutMs=timeoutMs;this.cycle=0;this.controller=null;this.latest=normalize();
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
   if(cycle===this.cycle)this.latest=state;
   return state;
  }
 }
 return {normalize,AgentMonitor};
});
