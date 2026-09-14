/* BALKAN TMS — app/router.js
   Ruter i iscrtavanje
   Modul generisan iz monolita v3.0 (A0.2). */
import { $, $$ } from '../core/dom.js';
import { can } from '../core/rbac.js';
import { state } from '../core/state.js';
import { Views } from '../modules/registry.js';
import { closeModal } from '../ui/modal.js';

window.go=route=>{state.route=route;closeModal();render();};
function render(){
  $$('#companySwitch button').forEach(b=>b.classList.toggle('active',b.dataset.c===state.companyId));
  $$('#nav a[data-route]').forEach(a=>a.classList.toggle('active',a.dataset.route===state.route));
  if(!can(state.route,'V'))state.route='dashboard';
  const view=Views[state.route]||Views.dashboard;
  $('#view').innerHTML=view();
  window.scrollTo(0,0);
}

export {
  render
};
