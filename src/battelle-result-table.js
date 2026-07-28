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
export const RESULT_COLUMN_PRESETS=Object.freeze({piat:Object.freeze(['label','pd','equivalentAge']),complete:Object.freeze(RESULT_COLUMN_DEFINITIONS.map(column=>column.id))});

export function selectResultColumns(selection=RESULT_COLUMN_PRESETS.piat){
  const selected=new Set(Array.isArray(selection)?selection:[]); selected.add('label');
  return RESULT_COLUMN_DEFINITIONS.filter(column=>selected.has(column.id));
}
export function serializeResultTable(model,selection){
  const columns=selectResultColumns(selection); const lines=[columns.map(column=>column.label).join('\t')];
  for(const row of model?.rows??[]) lines.push(columns.map(column=>displayValue(row[column.value])).join('\t'));
  return lines.join('\n');
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
export function buildResultTableModel({results,model,normativeData,professional=''}){
  if(!results||!model) throw new TypeError('Resultados y modelo son obligatorios.');
  const rows=ORDER.map(id=>buildNormalizedResultRow({id,source:results.subareas?.[id]??results.scales?.[id],model,results,normativeData}));
  const metadata={...results.metadata,ageMonths:results.summary.ageMonths,correctedAt:results.summary.correctedAt??results.correctedAt,professional:professional||'Usuario autenticado'};
  metadata.display=Object.freeze({birthDate:formatSpanishDate(metadata.birthDate),assessmentDate:formatSpanishDate(metadata.assessmentDate),correctedAt:formatSpanishDateTime(metadata.correctedAt),age:formatClinicalAge(metadata.ageMonths),professional:safePresentationText(metadata.professional)});
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
