/* BALKAN TMS — core/session.js
   Kompanije i opseg korisnika
   Modul generisan iz monolita v3.0 (A0.2). */
import { state } from './state.js';
import { Store } from './store.js';

function companyName(id){if(id==='ALL'||id==null)return 'Obe kompanije (zbirno)';const c=Store.get('companies',id);return c?c.name:id;}
function userCompanies(){const acc=Store.find('user_company_access',a=>a.user_id===state.user.id).map(a=>a.company_id);return Store.all('companies').filter(c=>acc.includes(c.id));}
function canSeeAll(){return userCompanies().length>1;}

export {
  companyName,
  userCompanies,
  canSeeAll
};
