/* BALKAN TMS — ui/charts.js
   Inline SVG grafikoni
   Modul generisan iz monolita v3.0 (A0.2). */
import { esc } from '../core/dom.js';

const CHART_COLORS=['#2563EB','#0E9488','#7C3AED','#D97706','#DC2626','#16A34A','#0891B2','#DB2777','#65A30D','#9333EA'];
function svgBars(data,opts){opts=opts||{};const w=opts.w||440,h=opts.h||200,pad=34,bw=(w-pad-8)/Math.max(1,data.length);const max=Math.max(1,...data.map(d=>d.value));
  const bars=data.map((d,i)=>{const bh=Math.round((d.value/max)*(h-pad-22));const x=pad+i*bw+bw*0.15,y=h-pad-bh;const col=d.color||CHART_COLORS[i%CHART_COLORS.length];
    return '<rect x="'+x+'" y="'+y+'" width="'+(bw*0.7)+'" height="'+bh+'" rx="3" fill="'+col+'"></rect>'+
      '<text x="'+(x+bw*0.35)+'" y="'+(y-4)+'" text-anchor="middle" font-size="9.5" fill="#5B6573">'+esc(opts.fmt?opts.fmt(d.value):d.value)+'</text>'+
      '<text x="'+(x+bw*0.35)+'" y="'+(h-pad+13)+'" text-anchor="middle" font-size="9.5" fill="#8A93A0">'+esc(d.label)+'</text>';}).join('');
  return '<svg viewBox="0 0 '+w+' '+h+'" class="svg-chart"><line x1="'+pad+'" y1="'+(h-pad)+'" x2="'+w+'" y2="'+(h-pad)+'" stroke="#E4E8EE"></line>'+bars+'</svg>';}
function svgGroupedBars(labels,series,opts){opts=opts||{};const w=opts.w||440,h=opts.h||210,pad=34;const groups=labels.length;const gw=(w-pad-8)/Math.max(1,groups);const max=Math.max(1,...series.flatMap(s=>s.values));const n=series.length;
  let out='';labels.forEach((lab,gi)=>{series.forEach((s,si)=>{const bw=(gw*0.7)/n;const bh=Math.round((s.values[gi]/max)*(h-pad-22));const x=pad+gi*gw+gw*0.15+si*bw;const y=h-pad-bh;out+='<rect x="'+x+'" y="'+y+'" width="'+(bw*0.86)+'" height="'+bh+'" rx="2" fill="'+(s.color||CHART_COLORS[si])+'"></rect>';});
    out+='<text x="'+(pad+gi*gw+gw*0.5)+'" y="'+(h-pad+13)+'" text-anchor="middle" font-size="9" fill="#8A93A0">'+esc(lab)+'</text>';});
  const leg='<div class="legend">'+series.map((s,i)=>'<span><i style="background:'+(s.color||CHART_COLORS[i])+'"></i>'+esc(s.name)+'</span>').join('')+'</div>';
  return '<svg viewBox="0 0 '+w+' '+h+'" class="svg-chart"><line x1="'+pad+'" y1="'+(h-pad)+'" x2="'+w+'" y2="'+(h-pad)+'" stroke="#E4E8EE"></line>'+out+'</svg>'+leg;}
function svgLine(labels,values,opts){opts=opts||{};const w=opts.w||440,h=opts.h||200,pad=34;const max=Math.max(1,...values),min=Math.min(0,...values);const span=max-min||1;const n=values.length;
  const X=i=>pad+(n<=1?0:i*(w-pad-8)/(n-1));const Y=v=>h-pad-((v-min)/span)*(h-pad-22);
  const pts=values.map((v,i)=>X(i)+','+Y(v)).join(' ');const dots=values.map((v,i)=>'<circle cx="'+X(i)+'" cy="'+Y(v)+'" r="3" fill="#2563EB"></circle>').join('');
  const labs=labels.map((l,i)=>'<text x="'+X(i)+'" y="'+(h-pad+13)+'" text-anchor="middle" font-size="9" fill="#8A93A0">'+esc(l)+'</text>').join('');
  return '<svg viewBox="0 0 '+w+' '+h+'" class="svg-chart"><line x1="'+pad+'" y1="'+(h-pad)+'" x2="'+w+'" y2="'+(h-pad)+'" stroke="#E4E8EE"></line><polyline fill="none" stroke="#2563EB" stroke-width="2" points="'+pts+'"></polyline>'+dots+labs+'</svg>';}
function svgDonut(data,opts){opts=opts||{};const sz=opts.sz||180,r=70,cx=sz/2,cy=sz/2;const tot=data.reduce((s,d)=>s+d.value,0)||1;let ang=-Math.PI/2;
  const arcs=data.map((d,i)=>{const frac=d.value/tot;const a2=ang+frac*2*Math.PI;const x1=cx+r*Math.cos(ang),y1=cy+r*Math.sin(ang),x2=cx+r*Math.cos(a2),y2=cy+r*Math.sin(a2);const large=frac>0.5?1:0;const col=d.color||CHART_COLORS[i%CHART_COLORS.length];ang=a2;return '<path d="M '+cx+' '+cy+' L '+x1+' '+y1+' A '+r+' '+r+' 0 '+large+' 1 '+x2+' '+y2+' Z" fill="'+col+'"></path>';}).join('');
  const hole='<circle cx="'+cx+'" cy="'+cy+'" r="42" fill="#fff"></circle>';
  const leg='<div class="legend">'+data.map((d,i)=>'<span><i style="background:'+(d.color||CHART_COLORS[i%CHART_COLORS.length])+'"></i>'+esc(d.label)+' ('+Math.round(d.value/tot*100)+'%)</span>').join('')+'</div>';
  return '<svg viewBox="0 0 '+sz+' '+sz+'" class="svg-chart" style="max-width:200px;margin:0 auto">'+arcs+hole+'</svg>'+leg;}

export {
  CHART_COLORS,
  svgBars,
  svgGroupedBars,
  svgLine,
  svgDonut
};
