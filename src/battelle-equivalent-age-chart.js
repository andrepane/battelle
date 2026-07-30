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

export function equivalentAgeChartLayout(model,{width=1280}={}){
  const left=260,right=110,top=model.kind==='comparison'?142:122,rowHeight=model.kind==='comparison'?68:54,bottom=68;
  const height=top+model.rows.length*rowHeight+bottom,plotRight=width-right,plotWidth=plotRight-left;
  return Object.freeze({width,height,left,right,top,bottom,rowHeight,plotRight,plotWidth});
}

export function equivalentAgeChartSvg(model,{width=1280}={}){
  const {height,left,right,top,bottom,rowHeight,plotRight,plotWidth}=equivalentAgeChartLayout(model,{width}),x=value=>left+(value/model.axisMax)*plotWidth;
  const ticks=[];for(let n=0;n<=model.axisMax;n+=12)ticks.push(n);
  const titleId='equivalent-age-title',descId='equivalent-age-description';
  const description=`${model.formatLabel}. Edades equivalentes normativas ya calculadas y referencias de edad cronológica. Los datos ausentes no se representan como cero.`;
  const grid=ticks.map(n=>`<line class="chart-grid" x1="${x(n)}" y1="${top}" x2="${x(n)}" y2="${height-bottom}"/><text class="chart-tick" x="${x(n)}" y="${height-bottom+27}" text-anchor="middle">${n}</text>`).join('');
  const legend=model.series.map((series,index)=>{const legendX=left+index*360,ageText=model.kind==='comparison'?`Edad cronológica ${index?'actual':'anterior'} · ${Number.isFinite(series.chronologicalAge)?`${series.chronologicalAge} meses`:'—'}`:`Edad cronológica · ${Number.isFinite(series.chronologicalAge)?`${series.chronologicalAge} meses`:'—'}`;return `<g class="chart-legend series-${index}" aria-label="${esc(series.label)}; ${esc(ageText)}"><${index===0&&model.kind==='comparison'?'rect':'circle'} ${index===0&&model.kind==='comparison'?`x="${legendX}" y="22" width="12" height="12"`:`cx="${legendX+6}" cy="28" r="7"`}/><text x="${legendX+23}" y="33">${esc(series.label)}</text><line class="legend-age-line" x1="${legendX}" y1="57" x2="${legendX+18}" y2="57"/><text x="${legendX+25}" y="62">${esc(ageText)}</text></g>`;}).join('');
  const ages=model.series.map((series,index)=>{if(!Number.isFinite(series.chronologicalAge))return '';const ageLabel=model.kind==='comparison'?`Edad cronológica ${index?'actual':'anterior'}: ${series.chronologicalAge} meses`:`Edad cronológica: ${series.chronologicalAge} meses`;const labelX=Math.min(Math.max(x(series.chronologicalAge),left+100),plotRight-100);return `<line class="age-line series-${index}" x1="${x(series.chronologicalAge)}" y1="${top-4}" x2="${x(series.chronologicalAge)}" y2="${height-bottom}"/><text class="age-label series-${index}" x="${labelX}" y="${top-14-index*18}" text-anchor="middle">${esc(ageLabel)}</text>`;}).join('');
  const marks=model.rows.map((row,rowIndex)=>{const center=top+rowIndex*rowHeight+rowHeight/2;const series=row.series.map((value,index)=>{const y=center+(model.kind==='comparison'?(index?13:-13):0);const label=`${row.label}. ${model.series[index].label}. ${value.accessibleText}${model.differences[row.id]?`. ${model.differences[row.id]}`:''}`;if(!value.numeric)return `<text class="missing-value" x="${left+14+index*34}" y="${y+5}" aria-label="${esc(label)}">—</text>`;const endpoint=value.kind==='range'?x(value.max):x(value.value),nearRight=endpoint>plotRight-85,labelX=nearRight?endpoint-14:endpoint+14,anchor=nearRight?'end':'start';const valueLabel=`<text class="value-label" x="${labelX}" y="${y+5}" text-anchor="${anchor}">${esc(value.text)}</text>`;if(value.kind==='point')return `<g class="chart-marker series-${index}" tabindex="0" role="img" aria-label="${esc(label)}"><title>${esc(label)}</title>${index===0&&model.kind==='comparison'?`<rect x="${x(value.value)-7}" y="${y-7}" width="14" height="14"/>`:`<circle cx="${x(value.value)}" cy="${y}" r="8"/>`}${valueLabel}</g>`;return `<g class="chart-marker chart-range series-${index}" tabindex="0" role="img" aria-label="${esc(label)}"><title>${esc(label)}</title><line x1="${x(value.min)}" y1="${y}" x2="${x(value.max)}" y2="${y}"/><line x1="${x(value.min)}" y1="${y-8}" x2="${x(value.min)}" y2="${y+8}"/><line x1="${x(value.max)}" y1="${y-8}" x2="${x(value.max)}" y2="${y+8}"/>${valueLabel}</g>`;}).join('');return `<g class="chart-row"><line class="chart-row-line" x1="${left}" y1="${center+rowHeight/2}" x2="${plotRight}" y2="${center+rowHeight/2}"/><text class="chart-row-label" x="${left-18}" y="${center+5}" text-anchor="end">${esc(row.label)}</text>${series}</g>`;}).join('');
  const alternatives=model.rows.map(row=>`<li>${esc(row.label)}: ${row.series.map((v,i)=>`${esc(model.series[i].label)}, ${esc(v.accessibleText)}`).join('; ')}</li>`).join('');
  return `<div class="equivalent-age-chart-scroll"><svg class="equivalent-age-chart" xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMinYMin meet" role="img" aria-labelledby="${titleId} ${descId}"><title id="${titleId}">${esc(model.title)}</title><desc id="${descId}">${esc(description)}</desc><style>text{font-family:Arial,sans-serif;fill:#142033}.chart-grid{stroke:#d9e1ec}.chart-row-line{stroke:#e6ebf2}.chart-tick{font-size:13px}.value-label{font-size:14px;font-weight:700}.chart-row-label{font-size:15px;font-weight:600}.series-0{fill:#666287;stroke:#666287}.series-1{fill:#2866b1;stroke:#2866b1}.age-line{stroke-width:2.5}.age-line.series-0,.series-0 .legend-age-line{stroke-dasharray:8 6}.age-line.series-1,.series-1 .legend-age-line{stroke-dasharray:2 5}.age-label{font-size:13px;font-weight:700}.chart-legend text{font-size:14px;font-weight:700;stroke:none}.legend-age-line{stroke-width:3}.chart-range line{stroke-width:7;stroke-linecap:round}.chart-marker:focus{outline:none}.chart-marker:focus>*{stroke:#111;stroke-width:3}.missing-value{fill:#607086;font-size:16px}</style><rect width="100%" height="100%" fill="white"/>${legend}${grid}${ages}${marks}<text x="${left+plotWidth/2}" y="${height-13}" text-anchor="middle">Edad equivalente (meses)</text></svg><div class="sr-only" aria-label="Alternativa textual del gráfico"><p>${esc(description)}</p><ul>${alternatives}</ul></div></div>`;
}
export function renderEquivalentAgeChart(container,model){container.innerHTML=equivalentAgeChartSvg(model);return container.querySelector('svg');}
export function safeChartFilename(model){const clean=s=>String(s||'paciente').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^A-Za-z0-9_-]+/g,'_').replace(/^_+|_+$/g,'').slice(0,50)||'paciente';return model.kind==='comparison'?`Battelle_comparacion_edades_equivalentes_${model.series.map(s=>s.date||'sin-fecha').join('_')}.png`:`Battelle_grafico_edades_equivalentes_${clean(model.patient)}_${model.series[0].date||'sin-fecha'}.png`;}
export async function chartPngBlob(svg,{scale=2,documentRef=globalThis.document,ImageCtor=globalThis.Image}={}){const xml=new XMLSerializer().serializeToString(svg),url=URL.createObjectURL(new Blob([xml],{type:'image/svg+xml'}));try{const image=await new Promise((resolve,reject)=>{const item=new ImageCtor();item.onload=()=>resolve(item);item.onerror=reject;item.src=url;});const canvas=documentRef.createElement('canvas');canvas.width=svg.viewBox.baseVal.width*scale;canvas.height=svg.viewBox.baseVal.height*scale;const context=canvas.getContext('2d');context.fillStyle='#fff';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(image,0,0,canvas.width,canvas.height);return await new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('png-unavailable')),'image/png'));}finally{URL.revokeObjectURL(url);}}
export function downloadChartBlob(blob,filename,{documentRef=globalThis.document}={}){const link=documentRef.createElement('a');link.href=URL.createObjectURL(blob);link.download=filename;link.click();setTimeout(()=>URL.revokeObjectURL(link.href),0);}
export async function copyChartPng(blob,{clipboard=globalThis.navigator?.clipboard,ClipboardItemCtor=globalThis.ClipboardItem}={}){if(!clipboard?.write||!ClipboardItemCtor)throw new Error('image-clipboard-unavailable');await clipboard.write([new ClipboardItemCtor({'image/png':blob})]);return true;}
