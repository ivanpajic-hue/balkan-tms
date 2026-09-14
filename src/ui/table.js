/* BALKAN TMS — ui/table.js
   Generička tabela + izvoz
   Modul generisan iz monolita v3.0 (A0.2). */
import { esc, toast } from '../core/dom.js';

const renderTableState={};
function renderTable(opts){
  const st=renderTableState[opts.id]||(renderTableState[opts.id]={q:'',sort:null,dir:1,filters:{}});
  let rows=opts.rows.slice();
  (opts.filters||[]).forEach(f=>{const v=st.filters[f.key];if(v)rows=rows.filter(r=>String(f.get?f.get(r):r[f.key])===v);});
  (opts.dateFilters||[]).forEach(f=>{const fr=st['df_'+f.key],to=st['dt_'+f.key];if(fr)rows=rows.filter(r=>{const v=f.get?f.get(r):r[f.key];return v&&v>=fr;});if(to)rows=rows.filter(r=>{const v=f.get?f.get(r):r[f.key];return v&&v<=to;});});
  if(st.q){const q=st.q.toLowerCase();rows=rows.filter(r=>opts.columns.some(c=>{const val=c.sortVal?c.sortVal(r):r[c.key];return String(val==null?'':val).toLowerCase().includes(q);}));}
  if(st.sort){const c=opts.columns.find(x=>x.key===st.sort);if(c)rows.sort((a,b)=>{let av=c.sortVal?c.sortVal(a):a[c.key],bv=c.sortVal?c.sortVal(b):b[c.key];if(typeof av==='number'&&typeof bv==='number')return (av-bv)*st.dir;return String(av==null?'':av).localeCompare(String(bv==null?'':bv))*st.dir;});}
  const filtHtml=(opts.filters||[]).map(f=>'<select data-filter="'+f.key+'"><option value="">'+esc(f.label)+': sve</option>'+f.options.map(o=>'<option value="'+esc(o.v)+'" '+(st.filters[f.key]===o.v?'selected':'')+'>'+esc(o.l)+'</option>').join('')+'</select>').join('')
    +(opts.dateFilters||[]).map(f=>'<span class="dfilt">'+esc(f.label)+': <input type="date" data-dfrom="'+f.key+'" value="'+esc(st['df_'+f.key]||'')+'"><input type="date" data-dto="'+f.key+'" value="'+esc(st['dt_'+f.key]||'')+'"></span>').join('');
  const head=opts.columns.map(c=>'<th class="'+(c.num?'num':'')+'" data-sort="'+c.key+'">'+esc(c.label)+(st.sort===c.key?' <span class="ar">'+(st.dir>0?'▲':'▼')+'</span>':'')+'</th>').join('')+(opts.actions?'<th class="num">Akcije</th>':'');
  const body=rows.length?rows.map(r=>'<tr data-id="'+r.id+'">'+opts.columns.map(c=>'<td class="'+(c.num?'num':'')+'">'+(c.render?c.render(r):esc(r[c.key]==null?'—':r[c.key]))+'</td>').join('')+(opts.actions?'<td class="num"><div class="row-act">'+opts.actions(r)+'</div></td>':'')+'</tr>').join(''):'<tr><td colspan="'+(opts.columns.length+(opts.actions?1:0))+'"><div class="empty"><div class="big">Nema zapisa</div><div>Promenite filtere ili dodajte novi unos.</div></div></td></tr>';
  const html='<div class="toolbar no-print"><input class="grow" placeholder="Pretraga..." data-tblsearch value="'+esc(st.q)+'">'+filtHtml+'<div class="right"><button class="btn sm" data-export="csv">Export CSV</button><button class="btn sm" data-export="xlsx">XLSX</button><button class="btn sm" data-export="print">Štampa</button></div></div><div class="tablewrap"><table><thead><tr>'+head+'</tr></thead><tbody>'+body+'</tbody></table></div>';
  setTimeout(()=>{const root=document.getElementById('tbl_'+opts.id);if(!root)return;
    const si=root.querySelector('[data-tblsearch]');if(si)si.oninput=e=>{st.q=e.target.value;rerenderTable(opts);};
    root.querySelectorAll('[data-filter]').forEach(s=>s.onchange=e=>{st.filters[e.target.dataset.filter]=e.target.value;rerenderTable(opts);});
    root.querySelectorAll('[data-dfrom]').forEach(s=>s.onchange=e=>{st['df_'+e.target.dataset.dfrom]=e.target.value;rerenderTable(opts);});
    root.querySelectorAll('[data-dto]').forEach(s=>s.onchange=e=>{st['dt_'+e.target.dataset.dto]=e.target.value;rerenderTable(opts);});
    root.querySelectorAll('th[data-sort]').forEach(th=>th.onclick=()=>{const k=th.dataset.sort;if(st.sort===k)st.dir*=-1;else{st.sort=k;st.dir=1;}rerenderTable(opts);});
    root.querySelectorAll('[data-export]').forEach(b=>b.onclick=()=>doExport(b.dataset.export,opts,rows));
  });
  return '<div id="tbl_'+opts.id+'">'+html+'</div>';
}
function rerenderTable(opts){const root=document.getElementById('tbl_'+opts.id);if(root){if(opts.getRows)opts.rows=opts.getRows();root.outerHTML=renderTable(opts);}}
function doExport(kind,opts,rows){
  const headers=opts.columns.map(c=>c.label);
  const data=rows.map(r=>opts.columns.map(c=>{const v=c.exportVal?c.exportVal(r):(c.sortVal?c.sortVal(r):r[c.key]);return v==null?'':String(v).replace(/<[^>]+>/g,'');}));
  if(kind==='print'){window.print();return;}
  if(kind==='xlsx'){if(typeof XLSX==='undefined'){toast('XLSX nije učitan (nema mreže) — koristite CSV');return;}const ws=XLSX.utils.aoa_to_sheet([headers].concat(data));const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,'Podaci');XLSX.writeFile(wb,(opts.exportName||'export')+'.xlsx');return;}
  const csv=[headers].concat(data).map(r=>r.map(c=>'"'+String(c).replace(/"/g,'""')+'"').join(';')).join('\n');
  const blob=new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=(opts.exportName||'export')+'.csv';a.click();
}

export {
  renderTableState,
  renderTable,
  rerenderTable,
  doExport
};
