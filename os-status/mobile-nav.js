(function(root, factory) {
  const api=factory();
  if (typeof module === 'object' && module.exports) module.exports=api;
  else { root.OcreMobileNav=api; api.setup(root.document, root); }
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  const allow=new Set(['status-overview','det-platform','loadHeading','det-dev','det-activity']);
  function destination(value) { return allow.has(value) ? value : null; }
  function setup(doc, host) {
    if (!doc || !host) return;
    const nav=doc.querySelector('.status-mobile-nav');
    if (!nav) return;
    const links=Array.from(nav.querySelectorAll('a[data-panel]'));
    function activate(id) {
      const target=id && doc.getElementById(id);
      if (!target) return false;
      if (target.tagName === 'DETAILS') target.open=true;
      links.forEach(a => {
        if (a.dataset.panel===id) a.setAttribute('aria-current','location');
        else a.removeAttribute('aria-current');
      });
      return true;
    }
    function synchronizeHash() {
      let raw='';
      try { raw=decodeURIComponent((host.location?.hash || '').slice(1)); } catch (_) { raw=''; }
      activate(destination(raw) || 'status-overview');
    }
    links.forEach(link=>link.addEventListener('click', e=>{
      const id=destination(link.dataset.panel);
      if (!activate(id)) e.preventDefault();
    }));
    host.addEventListener?.('hashchange', synchronizeHash);
    synchronizeHash();
  }
  return {setup,destination};
});
