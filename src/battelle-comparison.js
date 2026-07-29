import { runCorrection } from './battelle-correction.js';
import { buildResultTableModel, NOT_APPLICABLE } from './battelle-result-table.js';
import { WORKFLOW_STATUS } from './battelle-assessment-repository.js';

export const COMPARISON_ROWS = Object.freeze(['personal_social_total','adaptativa_total','motora_gruesa','motora_fina','motora_total','comunicacion_receptiva','comunicacion_expresiva','comunicacion_total','cognitiva_total','battelle_total']);
const copy = value => structuredClone(value);
const validDate = value => /^\d{4}-\d{2}-\d{2}$/.test(value ?? '') ? value : null;

export function orderAssessments(first, second) {
  const sameDate = validDate(first.assessmentDate) === validDate(second.assessmentDate);
  return {assessments:[first,second].sort((a,b)=>(validDate(a.assessmentDate)??'').localeCompare(validDate(b.assessmentDate)??'')||a.id.localeCompare(b.id)),sameDate};
}
export function identifyingDataDiffer(first, second) { return String(first.name??'').trim()!==String(second.name??'').trim()||first.birthDate!==second.birthDate; }
export function monthsBetween(firstDate, secondDate) {
  if(!validDate(firstDate)||!validDate(secondDate)) return null;
  const [fy,fm,fd]=firstDate.split('-').map(Number),[sy,sm,sd]=secondDate.split('-').map(Number);
  const months=(sy-fy)*12+sm-fm-(sd<fd?1:0); return months>=0?months:null;
}
function reconstruct(assessment,{items,model,normativeData,scoreAssessment}) {
  if(assessment.workflowStatus!==WORKFLOW_STATUS.CORRECTED) throw new Error('La evaluación ya no está corregida.');
  const result=runCorrection({assessment:copy(assessment),items,model,normativeData,scoreAssessment});
  if(!result.ok||!result.results) throw new Error('No se pudieron reconstruir los resultados con los datos normativos actuales.');
  return buildResultTableModel({results:result.results,model,normativeData,therapistName:assessment.therapistName});
}
export function buildAssessmentComparison({firstAssessment,secondAssessment,items,model,normativeData,scoreAssessment}) {
  if(!firstAssessment||!secondAssessment||firstAssessment.id===secondAssessment.id) throw new Error('Selecciona dos evaluaciones diferentes.');
  const {assessments,sameDate}=orderAssessments(copy(firstAssessment),copy(secondAssessment));
  const models=assessments.map(assessment=>reconstruct(assessment,{items,model,normativeData,scoreAssessment}));
  const maps=models.map(result=>new Map(result.rows.map(row=>[row.id,row])));
  const rows=COMPARISON_ROWS.map(id=>Object.freeze({id,label:maps[0].get(id)?.label??id,type:maps[0].get(id)?.type,previousPd:maps[0].get(id)?.pd??NOT_APPLICABLE,currentPd:maps[1].get(id)?.pd??NOT_APPLICABLE,previousEquivalentAge:maps[0].get(id)?.equivalentAge??NOT_APPLICABLE,currentEquivalentAge:maps[1].get(id)?.equivalentAge??NOT_APPLICABLE}));
  return Object.freeze({assessments:Object.freeze(assessments),models:Object.freeze(models),rows:Object.freeze(rows),sameDate,identifyingDataDiffer:identifyingDataDiffer(...assessments),monthsBetween:monthsBetween(assessments[0].assessmentDate,assessments[1].assessmentDate)});
}
