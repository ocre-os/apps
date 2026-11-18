const t=require('node:test'),a=require('node:assert/strict');
const C=require('./compact-ui.js');
const D=require('./devenv.js');
t('cuota muestra lectura y fuente',()=>{
  const now=Date.now();
  const raw={slots_used:0,turn_seconds:null,quota:{state:'available',remaining_percent:40,resets_at:new Date(now+3600e3).toISOString(),observed_at:new Date(now-5*60e3).toISOString()}};
  const st=D.normalize({contract:'ocre-devenv-v1',observed_at:new Date(now).toISOString(),agents:{claude:raw,codex:{...raw,quota:{state:'unknown',remaining_percent:null,resets_at:null,observed_at:new Date(now-3*3600e3).toISOString()}}},events:[]});
  const html=C.card('claude',st.agents.claude,'working');
  a.match(html,/Hace 5 min/); a.match(html,/sesiones interactivas/);
  a.equal(C.quota(st.agents.codex.quota).text,'Sin medición reciente');
  a.match(C.card('codex',st.agents.codex),/Hace 3 h/);
  const noObs=D.normalize({contract:'ocre-devenv-v1',observed_at:new Date(now).toISOString(),agents:{claude:{slots_used:0,quota:{state:'unknown'}},codex:{slots_used:0,quota:{}}},events:[]});
  a.equal(C.quota(noObs.agents.claude.quota).text,'Sin medición');
  a.match(C.card('claude',noObs.agents.claude),/Sin lectura registrada/);
});
