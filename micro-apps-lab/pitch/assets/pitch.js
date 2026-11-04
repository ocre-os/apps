'use strict';
document.addEventListener('DOMContentLoaded',()=>{
  document.querySelectorAll('[data-print]').forEach(button=>button.addEventListener('click',()=>window.print()));
  const currency=new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN',minimumFractionDigits:2,maximumFractionDigits:2});
  document.querySelectorAll('[data-unit-economics]').forEach(section=>{
    const price=Number(section.dataset.price);
    const slider=section.querySelector('[data-volume-slider]');
    const volumeLabel=section.querySelector('[data-volume]');
    const unit=section.querySelector('[data-unit-result]');
    const monthly=section.querySelector('[data-month-result]');
    const status=section.querySelector('[data-econ-status]');
    const fields=['fee_pct','fee_fixed','variable_cost'].map(k=>section.querySelector('[name="'+k+'"]'));
    function update(){
      const count=Number(slider.value);
      volumeLabel.textContent=String(count);
      if(fields.some(x=>x.value.trim()==='')){
        unit.textContent='—';monthly.textContent='—';
        status.textContent='Completa los tres costos; escribe cero explícitamente cuando corresponda.';
        status.dataset.level='neutral';return;
      }
      if(fields.some(x=>!x.validity.valid||!Number.isFinite(Number(x.value)))){
        unit.textContent='—';monthly.textContent='—';status.textContent='Corrige los valores de costos y comisiones.';
        status.dataset.level='warning';return;
      }
      const [pct,fixed,variable]=fields.map(x=>Number(x.value));
      const margin=price-price*pct/100-fixed-variable;
      unit.textContent=currency.format(margin);
      monthly.textContent=currency.format(margin*count);
      status.textContent=margin<0?'Los costos superan el precio: contribución negativa por cobro.':margin===0?'Contribución nula antes de gastos fijos y adquisición.':'Contribución ilustrativa positiva, antes de adquisición e impuestos.';
      status.dataset.level=margin<=0?'warning':'positive';
    }
    [slider,...fields].forEach(x=>x.addEventListener('input',update));
    update();
  });
});
