const test=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const {join}=require('node:path');
const Nav=require('./mobile-nav');
const html=readFileSync(join(__dirname,'index.html'),'utf8');
const css=readFileSync(join(__dirname,'compact.css'),'utf8');
const panels=['status-overview','det-platform','loadHeading','det-dev','det-activity'];
test('only known local dashboard anchors are navigable',()=>{
 for(const name of panels) assert.equal(Nav.destination(name),name);
 for(const unsafe of ['https://example.test','../../','det-internal','__proto__'])
  assert.equal(Nav.destination(unsafe),null);
});
test('five mobile anchors have matching source IDs and remain accessible',()=>{
 const links=[...html.matchAll(/data-panel="([^"]+)"/g)].map(x=>x[1]);
 assert.deepEqual(links,panels);
 for(const id of links) assert.match(html,new RegExp('id="'+id+'"'));
 assert.match(html,/aria-label="Secciones de Status"/);
 assert.match(css,/min-height:44px/);
 assert.match(css,/safe-area-inset-bottom/);
 assert.match(css,/safe-area-inset-right/);
 assert.match(css,/:focus-visible/);
 assert.match(css,/aria-current=location/);
});
test('native fragment links work without scripting',()=>{
 for(const id of ['det-platform','det-dev','det-activity'])
  assert.match(html,new RegExp('href="#'+id+'"'));
});
test('initial deep link and browser back synchronize expanded panel and current location',()=>{
 const links=panels.map(id=>({
  dataset:{panel:id}, attrs:{}, listeners:{},
  addEventListener(type, fn){this.listeners[type]=fn;},
  setAttribute(key,value){this.attrs[key]=value;},
  removeAttribute(key){delete this.attrs[key];}
 }));
 const elements=Object.fromEntries(panels.map(id=>[id,{tagName:id.startsWith('det-')?'DETAILS':'SECTION',open:false}]));
 const nav={querySelectorAll(){return links;}};
 const doc={querySelector(){return nav;},getElementById(id){return elements[id]||null;}};
 const host={location:{hash:'#det-dev'},events:{},addEventListener(k,fn){this.events[k]=fn;}};
 Nav.setup(doc,host);
 assert.equal(elements['det-dev'].open,true);
 assert.equal(links[3].attrs['aria-current'],'location');
 assert.equal(links[0].attrs['aria-current'],undefined);
 host.location.hash='#det-platform';
 host.events.hashchange();
 assert.equal(elements['det-platform'].open,true);
 assert.equal(links[1].attrs['aria-current'],'location');
 assert.equal(links[3].attrs['aria-current'],undefined);
 host.location.hash='#%ZZ';
 host.events.hashchange();
 assert.equal(links[0].attrs['aria-current'],'location');
});
