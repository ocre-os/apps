'use strict';
document.addEventListener('DOMContentLoaded',()=>{
  document.querySelectorAll('[data-print]').forEach(button=>button.addEventListener('click',()=>window.print()));
  document.querySelectorAll('[data-sim-price]').forEach(slider=>{
    const amount=document.querySelector('[data-gross]');
    const count=document.querySelector('[data-volume]');
    const price=Number(slider.dataset.simPrice);
    const currency=new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN',maximumFractionDigits:0});
    const sync=()=>{let units=Number(slider.value);count.textContent=String(units);amount.textContent=currency.format(units*price)};
    slider.addEventListener('input',sync);sync();
  });
});
