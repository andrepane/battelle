import { lookupGeneralConversion } from './battelle-conversions.js';

export const NOT_APPLICABLE='—';
export const RESULT_COLUMN_DEFINITIONS=Object.freeze([
  {id:'label',label:'Área / subárea',value:'label',alignment:'left',recommendedWidth:3.8,required:true},
  {id:'pd',label:'PD',value:'pd',alignment:'center',recommendedWidth:1},
  {id:'pc',label:'PC',value:'pc',alignment:'center',recommendedWidth:1},
  {id:'z',label:'z',value:'z',alignment:'center',recommendedWidth:1},
  {id:'T',label:'T',value:'T',alignment:'center',recommendedWidth:1},
  {id:'CI',label:'CI',value:'CI',alignment:'center',recommendedWidth:1},
  {id:'ECN',label:'ECN',value:'ECN',alignment:'center',recommendedWidth:1},
  {id:'equivalentAge',label:'Edad equivalente',value:'equivalentAge',alignment:'center',recommendedWidth:2}
].map(Object.freeze));
export const RESULT_COLUMNS=Object.freeze(RESULT_COLUMN_DEFINITIONS.map(column=>column.label));
const PIAT_ROWS=['personal_social_total','adaptativa_total','motora_gruesa','motora_fina','motora_total','comunicacion_receptiva','comunicacion_expresiva','comunicacion_total','cognitiva_total','battelle_total'];
const MAIN_AREA_ROWS=['personal_social_total','adaptativa_total','motora_total','comunicacion_total','cognitiva_total','battelle_total'];
const COMPACT_COLUMNS=['label','pd','equivalentAge'];
export const RESULT_FORMATS=Object.freeze({
  piat:Object.freeze({id:'piat',label:'Resumen PIAT',rowIds:Object.freeze(PIAT_ROWS),defaultColumns:Object.freeze(COMPACT_COLUMNS),presentation:'compact',pdfOrientation:'portrait'}),
  mainAreas:Object.freeze({id:'mainAreas',label:'Áreas principales',rowIds:Object.freeze(MAIN_AREA_ROWS),defaultColumns:Object.freeze(COMPACT_COLUMNS),presentation:'compact',pdfOrientation:'portrait'}),
  complete:Object.freeze({id:'complete',label:'Tabla completa',rowIds:null,defaultColumns:Object.freeze(RESULT_COLUMN_DEFINITIONS.map(column=>column.id)),presentation:'hierarchical',pdfOrientation:'landscape'})
});
export const RESULT_COLUMN_PRESETS=Object.freeze(Object.fromEntries(Object.entries(RESULT_FORMATS).map(([id,format])=>[id,format.defaultColumns])));
const COMPACT_LABELS=Object.freeze({personal_social_total:'Personal/Social',adaptativa_total:'Adaptativa',motora_gruesa:'Motora gruesa',motora_fina:'Motora fina',motora_total:'Motora',comunicacion_receptiva:'Comunicación receptiva',comunicacion_expresiva:'Comunicación expresiva',comunicacion_total:'Comunicación',cognitiva_total:'Cognitiva',battelle_total:'Battelle total'});
const PIAT_COMPONENT_ROWS=new Set(['motora_gruesa','motora_fina','comunicacion_receptiva','comunicacion_expresiva']);
const MAIN_TOTAL_ROWS=new Set(['personal_social_total','adaptativa_total','motora_total','comunicacion_total','cognitiva_total']);

function presentationRowType(row,formatId){
  if(row.id==='battelle_total')return 'grand-total';
  if(formatId==='piat')return PIAT_COMPONENT_ROWS.has(row.id)?'component':'total';
  if(formatId==='mainAreas')return MAIN_TOTAL_ROWS.has(row.id)?'total':row.type;
  return row.type;
}

export function selectResultColumns(selection=RESULT_COLUMN_PRESETS.piat){
  const selected=new Set(Array.isArray(selection)?selection:[]); selected.add('label');
  return RESULT_COLUMN_DEFINITIONS.filter(column=>selected.has(column.id));
}
export function serializeResultTable(model,selection){
  const view=isPresentationModel(model)?model:createResultPresentation(model,{columns:selection});
  const lines=[view.columns.map(column=>column.label).join('\t')];
  for(const row of view.rows) lines.push(view.columns.map(column=>displayValue(row[column.value])).join('\t'));
  return lines.join('\n');
}
function isPresentationModel(model){return Boolean(model?.format&&Array.isArray(model?.columns)&&Array.isArray(model?.rows));}
export function createResultPresentation(model,{formatId='complete',columns}={}){
  if(!model?.rows)throw new TypeError('Modelo de resultados vacío.');
  const format=RESULT_FORMATS[formatId]??RESULT_FORMATS.complete;
  const selectedColumns=selectResultColumns(columns??format.defaultColumns).map(column=>column.id==='label'&&format.presentation==='compact'?Object.freeze({...column,label:'Área'}):column);
  const byId=new Map(model.rows.map(row=>[row.id,row]));
  const sourceRows=format.rowIds?format.rowIds.map(id=>byId.get(id)).filter(Boolean):model.rows;
  const rows=sourceRows.map(row=>Object.freeze({...row,label:format.presentation==='compact'?(COMPACT_LABELS[row.id]??row.canonicalLabel):row.label,type:presentationRowType(row,format.id)}));
  const orientation=selectedColumns.length<=4?'portrait':'landscape';
  return Object.freeze({...model,format,columns:selectedColumns,rows:Object.freeze(rows),orientation});
}
function escapeHtml(value){return displayValue(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));}
export function serializeResultTableHtml(model,selection){
  const view=isPresentationModel(model)?model:createResultPresentation(model,{columns:selection});
  const cells=view.columns.map(column=>`<th style="border:1px solid #999;padding:6px;background:#eee;text-align:${column.alignment}">${escapeHtml(column.label)}</th>`).join('');
  const rows=view.rows.map(row=>`<tr data-row-type="${row.type}">${view.columns.map(column=>{const emphasis=row.type==='grand-total'?';font-weight:900;background:#e7eef8;border-top:3px solid #2357a4':row.type==='total'?';font-weight:bold;background:#f4f7fb;border-top:2px solid #8295ad':'';const indent=row.type==='component'&&column.id==='label'?';padding-left:18px':'';return `<${column.id==='label'?'th':'td'} style="border:1px solid #999;padding:6px;text-align:${column.alignment}${emphasis}${indent}">${escapeHtml(row[column.value])}</${column.id==='label'?'th':'td'}>`;}).join('')}</tr>`).join('');
  return `<table style="border-collapse:collapse;font-family:Arial,sans-serif"><thead><tr>${cells}</tr></thead><tbody>${rows}</tbody></table>`;
}
export async function copyResultTable(model,{clipboard=globalThis.navigator?.clipboard,ClipboardItemCtor=globalThis.ClipboardItem}={}){
  const plain=serializeResultTable(model),html=serializeResultTableHtml(model);
  if(clipboard?.write&&ClipboardItemCtor){
    try{await clipboard.write([new ClipboardItemCtor({'text/html':new Blob([html],{type:'text/html'}),'text/plain':new Blob([plain],{type:'text/plain'})})]);return 'formatted';}catch{/* Intenta la alternativa tabulada. */}
  }
  if(clipboard?.writeText){try{await clipboard.writeText(plain);return 'text';}catch{/* Mensaje uniforme en la interfaz. */}}
  throw new Error('clipboard-unavailable');
}
const ORDER=Object.freeze([
  'personal_social_interaccion_con_el_adulto','personal_social_expresion_de_sentimientos_afecto','personal_social_autoconcepto','personal_social_interaccion_con_los_companeros','personal_social_colaboracion','personal_social_rol_social','personal_social_total',
  'adaptativa_atencion','adaptativa_comida','adaptativa_vestido','adaptativa_responsabilidad_personal','adaptativa_aseo','adaptativa_total',
  'motora_control_muscular','motora_coordinacion_corporal','motora_locomocion','motora_gruesa','motora_motricidad_fina','motora_motricidad_perceptiva','motora_fina','motora_total',
  'comunicacion_receptiva','comunicacion_expresiva','comunicacion_total',
  'cognitiva_discriminacion_perceptiva','cognitiva_memoria','cognitiva_razonamiento_y_habilidades_escolares','cognitiva_desarrollo_conceptual','cognitiva_total','battelle_total'
]);
const DISPLAY=Object.freeze({personal_social_total:'TOTAL PERSONAL/SOCIAL',adaptativa_total:'TOTAL ADAPTATIVA',motora_gruesa:'PUNTUACIÓN MOTORA GRUESA',motora_fina:'PUNTUACIÓN MOTORA FINA',motora_total:'TOTAL MOTORA',comunicacion_total:'TOTAL COMUNICACIÓN',cognitiva_total:'TOTAL COGNITIVA',battelle_total:'PUNTUACIÓN TOTAL BATTELLE'});
const AGGREGATES=new Set(Object.keys(DISPLAY));
const SCALE_ROWS=new Set(PIAT_ROWS);

function value(v){ return v===null||v===undefined||typeof v==='object'||(typeof v==='number'&&!Number.isFinite(v))?NOT_APPLICABLE:v; }
function pcOf(source,id,results){
  if(id==='battelle_total'){ const p=results.totalCentile; return p?.ok?{value:p.centile,kind:'centil',provenance:p.provenance,table:p.table}:null; }
  const p=source?.percentile; return p?.ok?{value:p.percentile,kind:'percentil',provenance:p.provenance,table:p.table}:null;
}
export function buildNormalizedResultRow({id,source,model,results,normativeData}){
  const pc=pcOf(source,id,results); const conversion=pc?lookupGeneralConversion({pc:pc.value,normativeData}):null;
  const canonical=model.subareas?.[id]?.nombre??model.escalas?.[id]?.nombre??id;
  const equivalent=source?.equivalentAge?.ok?(source.equivalentAge.text??source.equivalentAgeLabel):NOT_APPLICABLE;
  return Object.freeze({id,label:DISPLAY[id]??canonical,canonicalLabel:canonical,type:id==='battelle_total'?'grand-total':AGGREGATES.has(id)?'total':'subarea',pd:value(source?.pd),pc:value(pc?.value),pcKind:pc?.kind??null,z:value(conversion?.ok?conversion.z:null),T:value(conversion?.ok?conversion.T:null),CI:value(conversion?.ok?conversion.CI:null),ECN:value(conversion?.ok?conversion.ECN:null),equivalentAge:value(equivalent),provenance:{pc,conversion:conversion?.ok?{table:conversion.table,source:conversion.provenance}:null,equivalentAge:source?.equivalentAge?.ok?{table:source.equivalentAge.table,source:source.equivalentAge.provenance}:null},technicalError:pc&&!conversion?.ok?conversion.error:null});
}
export function buildResultTableModel({results,model,normativeData,therapistName=null,professional='',historyNumber=null}){
  if(!results||!model) throw new TypeError('Resultados y modelo son obligatorios.');
  const rows=ORDER.map(id=>buildNormalizedResultRow({id,source:SCALE_ROWS.has(id)?results.scales?.[id]:results.subareas?.[id],model,results,normativeData}));
  const therapist=safePresentationText(therapistName??professional,'Sin asignar');
  const metadata={...results.metadata,historyNumber,ageMonths:results.summary.ageMonths,correctedAt:results.summary.correctedAt??results.correctedAt,therapistName:therapist};
  metadata.display=Object.freeze({birthDate:formatSpanishDate(metadata.birthDate),assessmentDate:formatSpanishDate(metadata.assessmentDate),correctedAt:formatSpanishDateTime(metadata.correctedAt),age:formatClinicalAge(metadata.ageMonths),therapistName:therapist});
  return Object.freeze({columns:RESULT_COLUMN_DEFINITIONS,rows,metadata,warnings:(results.warnings??[]).map(w=>({item:safePresentationText(w.codigo??w.code??w.subarea??'Evaluación'),message:safePresentationText(w.mensaje??w.message??String(w))}))});
}
export function resultRowOrder(){ return [...ORDER]; }
export function displayValue(value){ return value===NOT_APPLICABLE?NOT_APPLICABLE:String(value); }
export function safePresentationText(value,fallback=NOT_APPLICABLE){
  if(value===undefined||value===null||typeof value==='object') return fallback;
  const text=String(value).trim(); return !text||/^(?:undefined|null|NaN|\[object Object\])$/i.test(text)?fallback:text;
}
export function formatSpanishDate(value){
  const match=String(value??'').match(/^(\d{4})-(\d{2})-(\d{2})/); return match?`${match[3]}/${match[2]}/${match[1]}`:NOT_APPLICABLE;
}
export function formatSpanishDateTime(value){
  if(!value) return NOT_APPLICABLE; const date=new Date(value); if(Number.isNaN(date.valueOf())) return NOT_APPLICABLE;
  return new Intl.DateTimeFormat('es-ES',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',hour12:false,timeZone:'UTC'}).format(date).replace(',', '');
}
export function formatClinicalAge(months){ return Number.isInteger(months)&&months>=0?`${Math.floor(months/12)} años, ${months%12} meses (${months} meses)`:NOT_APPLICABLE; }
