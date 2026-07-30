import { RESULT_FORMATS, COMPACT_LABELS, NOT_APPLICABLE, formatSpanishDate } from './battelle-result-table.js';

const SERIES_LABELS=Object.freeze(['Anterior','Actual']);
const freeze=value=>{if(value&&typeof value==='object'&&!Object.isFrozen(value)){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};
const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export function parseEquivalentAge(original){
  if(original===null||original===undefined||original===NOT_APPLICABLE||String(original).trim()==='') return freeze({kind:'missing',text:NOT_APPLICABLE,numeric:false,min:null,max:null,value:null,accessibleText:'Sin edad equivalente disponible'});
  const text=String(original).trim();
  if(/^\d+(?:\.\d+)?$/.test(text)){const value=Number(text);return freeze({kind:'point',text,numeric:true,min:value,max:value,value,accessibleText:`${text} meses`});}
  const interval=text.match(/^(\d+(?:\.\d+)?)\s*[-–]\s*(\d+(?:\.\d+)?)$/);
  if(interval){const min=Number(interval[1]),max=Number(interval[2]);if(min<=max)return freeze({kind:'range',text,numeric:true,min,max,value:null,accessibleText:`${text} meses`});}
  return freeze({kind:'error',text,numeric:false,min:null,max:null,value:null,accessibleText:`Edad equivalente no representable: ${text}`});
}

/** Construye exclusivamente una vista inmutable de edades equivalentes ya calculadas. */
export function buildEquivalentAgeChartModel({assessments,formatId='piat',title='Gráfico de edades equivalentes',patient=''}){
  if(!Array.isArray(assessments)||!assessments.length||assessments.length>2) throw new TypeError('Se requiere una o dos evaluaciones corregidas.');
  const format=RESULT_FORMATS[formatId];
  if(!format?.rowIds) throw new Error('El gráfico está disponible para Resumen PIAT y Áreas principales.');
  const series=assessments.map((entry,index)=>{
    const model=entry.model??entry;
    const assessment=entry.assessment??{};
    const date=assessment.assessmentDate??model.metadata?.assessmentDate??null;
    const ageMonths=model.metadata?.ageMonths;
    const role=assessments.length===1?'Evaluación':(entry.label??SERIES_LABELS[index]);
    const label=`${role} · ${formatSpanishDate(date)}`;
    const values=Object.fromEntries(model.rows.map(row=>[row.id,row.equivalentAgeTechnicalError?freeze({kind:'error',text:String(row.equivalentAge),numeric:false,min:null,max:null,value:null,accessibleText:'Edad equivalente no representable por un error técnico'}):parseEquivalentAge(row.equivalentAge)]));
    return {id:assessment.id??`series-${index+1}`,role,label,date,dateLabel:formatSpanishDate(date),chronologicalAge:Number.isFinite(ageMonths)?ageMonths:null,values};
  });
  const sourceRows=new Map((assessments.at(-1).model??assessments.at(-1)).rows.map(row=>[row.id,row]));
  const rows=format.rowIds.map(id=>({id,label:COMPACT_LABELS[id]??sourceRows.get(id)?.label??id,series:series.map(item=>item.values[id]??parseEquivalentAge(null))}));
  const numeric=[...series.flatMap(s=>Object.values(s.values).flatMap(v=>v.numeric?[v.max]:[])),...series.flatMap(s=>Number.isFinite(s.chronologicalAge)?[s.chronologicalAge]:[])];
  const differences=assessments.length===2?Object.fromEntries(rows.map(row=>{const [a,b]=row.series;return [row.id,a.kind==='point'&&b.kind==='point'?`Diferencia entre resultados: ${b.value-a.value>=0?'+':''}${b.value-a.value} meses`:null];})):{};
  return freeze({kind:assessments.length===1?'individual':'comparison',formatId,formatLabel:format.label,title,patient:String(patient||''),rows,series,axisMax:Math.max(12,Math.ceil((Math.max(0,...numeric)+6)/12)*12),differences,warnings:rows.flatMap(row=>row.series.some(v=>v.kind==='error')?[`${row.label}: edad equivalente no representable.`]:[])});
}

export function equivalentAgeChartSvg(model,{width=1100}={}){
  const left=235,right=45,top=105,rowHeight=model.kind==='comparison'?58:46,bottom=65;
  const height=top+model.rows.length*rowHeight+bottom,plot=width-left-right,x=value=>left+(value/model.axisMax)*plot;
  const ticks=[];for(let n=0;n<=model.axisMax;n+=12)ticks.push(n);
  const titleId='equivalent-age-title',descId='equivalent-age-description';
  const description=`${model.formatLabel}. Edades equivalentes normativas ya calculadas y referencias de edad cronológica. Los datos ausentes no se representan como cero.`;
  const grid=ticks.map(n=>`<line class="chart-grid" x1="${x(n)}" y1="${top-12}" x2="${x(n)}" y2="${height-bottom+5}"/><text class="chart-tick" x="${x(n)}" y="${height-bottom+28}" text-anchor="middle">${n}</text>`).join('');
  const ages=model.series.map((s,i)=>Number.isFinite(s.chronologicalAge)?`<line class="age-line series-${i}" x1="${x(s.chronologicalAge)}" y1="${top-24}" x2="${x(s.chronologicalAge)}" y2="${height-bottom+5}"/><text class="age-label series-${i}" x="${x(s.chronologicalAge)}" y="${top-31-i*17}" text-anchor="middle">${esc(s.role)}: ${s.chronologicalAge} meses</text>`:'').join('');
  const marks=model.rows.map((row,rowIndex)=>{
    const center=top+rowIndex*rowHeight;
    const series=row.series.map((value,i)=>{const y=center+(model.kind==='comparison'?(i?10:-10):0);const label=`${row.label}. ${model.series[i].label}. ${value.accessibleText}${model.differences[row.id]?`. ${model.differences[row.id]}`:''}`;
      if(value.kind==='point')return `<g class="chart-marker series-${i}" tabindex="0" role="img" aria-label="${esc(label)}"><title>${esc(label)}</title>${i===0&&model.kind==='comparison'?`<rect x="${x(value.value)-5}" y="${y-5}" width="10" height="10"/>`:`<circle cx="${x(value.value)}" cy="${y}" r="6"/>`}<text class="value-label" x="${x(value.value)+10}" y="${y+4}">${esc(value.text)}</text></g>`;
      if(value.kind==='range')return `<g class="chart-marker chart-range series-${i}" tabindex="0" role="img" aria-label="${esc(label)}"><title>${esc(label)}</title><line x1="${x(value.min)}" y1="${y}" x2="${x(value.max)}" y2="${y}"/><line x1="${x(value.min)}" y1="${y-6}" x2="${x(value.min)}" y2="${y+6}"/><line x1="${x(value.max)}" y1="${y-6}" x2="${x(value.max)}" y2="${y+6}"/><text class="value-label" x="${x(value.max)+10}" y="${y+4}">${esc(value.text)}</text></g>`;
      return `<text class="missing-value" x="${left+8+i*30}" y="${y+4}" aria-label="${esc(label)}">—</text>`;}).join('');
    return `<g class="chart-row"><line class="chart-row-line" x1="${left}" y1="${center+rowHeight/2-4}" x2="${width-right}" y2="${center+rowHeight/2-4}"/><text class="chart-row-label" x="${left-12}" y="${center+4}" text-anchor="end">${esc(row.label)}</text>${series}</g>`;
  }).join('');
  const legend=model.series.map((s,i)=>`<text class="legend series-${i}" x="${left+i*260}" y="68">${i===0&&model.kind==='comparison'?'■':'●'} ${esc(s.label)}</text>`).join('');
  const alternatives=model.rows.map(row=>`<li>${esc(row.label)}: ${row.series.map((v,i)=>`${esc(model.series[i].label)}, ${esc(v.accessibleText)}`).join('; ')}</li>`).join('');
  return `<div class="equivalent-age-chart-scroll"><svg class="equivalent-age-chart" xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="${titleId} ${descId}"><title id="${titleId}">${esc(model.title)}</title><desc id="${descId}">${esc(description)}</desc><style>text{font-family:Arial,sans-serif;fill:#142033}.chart-title{font-size:20px;font-weight:700}.chart-grid{stroke:#d9e1ec}.chart-row-line{stroke:#edf1f6}.chart-tick,.value-label{font-size:12px}.chart-row-label{font-size:14px;font-weight:600}.series-0{fill:#6b668f;stroke:#6b668f}.series-1{fill:#2866b1;stroke:#2866b1}.age-line{stroke-width:2}.age-line.series-0{stroke-dasharray:7 5}.age-line.series-1{stroke-dasharray:2 4}.age-label,.legend{font-size:13px;font-weight:700}.chart-range line{stroke-width:5}.chart-marker:focus{outline:none}.chart-marker:focus>*{stroke:#111;stroke-width:3}.missing-value{fill:#607086}</style><rect width="100%" height="100%" fill="white"/><text class="chart-title" x="${left}" y="31">${esc(model.title)}</text>${legend}${grid}${ages}${marks}<text x="${left+plot/2}" y="${height-12}" text-anchor="middle">Edad equivalente (meses)</text></svg><div class="sr-only" aria-label="Alternativa textual del gráfico"><p>${esc(description)}</p><ul>${alternatives}</ul></div></div>`;
}

export function renderEquivalentAgeChart(container,model){container.innerHTML=equivalentAgeChartSvg(model);return container.querySelector('svg');}
export function safeChartFilename(model){const clean=s=>String(s||'paciente').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^A-Za-z0-9_-]+/g,'_').replace(/^_+|_+$/g,'').slice(0,50)||'paciente';return model.kind==='comparison'?`Battelle_comparacion_edades_equivalentes_${model.series.map(s=>s.date||'sin-fecha').join('_')}.png`:`Battelle_grafico_edades_equivalentes_${clean(model.patient)}_${model.series[0].date||'sin-fecha'}.png`;}
export async function chartPngBlob(svg,{scale=2,documentRef=globalThis.document,ImageCtor=globalThis.Image}={}){const xml=new XMLSerializer().serializeToString(svg),url=URL.createObjectURL(new Blob([xml],{type:'image/svg+xml'}));try{const image=await new Promise((resolve,reject)=>{const item=new ImageCtor();item.onload=()=>resolve(item);item.onerror=reject;item.src=url;});const canvas=documentRef.createElement('canvas');canvas.width=svg.viewBox.baseVal.width*scale;canvas.height=svg.viewBox.baseVal.height*scale;const context=canvas.getContext('2d');context.fillStyle='#fff';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(image,0,0,canvas.width,canvas.height);return await new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('png-unavailable')),'image/png'));}finally{URL.revokeObjectURL(url);}}
export function downloadChartBlob(blob,filename,{documentRef=globalThis.document}={}){const link=documentRef.createElement('a');link.href=URL.createObjectURL(blob);link.download=filename;link.click();setTimeout(()=>URL.revokeObjectURL(link.href),0);}
export async function copyChartPng(blob,{clipboard=globalThis.navigator?.clipboard,ClipboardItemCtor=globalThis.ClipboardItem}={}){if(!clipboard?.write||!ClipboardItemCtor)throw new Error('image-clipboard-unavailable');await clipboard.write([new ClipboardItemCtor({'image/png':blob})]);return true;}
