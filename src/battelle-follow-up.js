import { scorePresentation } from './battelle-score-presentation.js';
import { todayIso } from './battelle-state.js';
const VALID_SCORE = new Set([0, 1, 2]);
export function createFollowUpAssessmentSeed({ previousAssessment, now = new Date(), id }) {
  if (!previousAssessment || typeof previousAssessment.id !== 'string' || previousAssessment.id === id) throw new Error('La evaluación de referencia no es válida.');
  const instant = now instanceof Date ? now : new Date(now);
  if (Number.isNaN(instant.getTime())) throw new Error('La fecha de creación no es válida.');
  return { id, name:previousAssessment.name??'', therapistName:previousAssessment.therapistName??null, birthDate:previousAssessment.birthDate??'', assessmentDate:todayIso(instant), ageMonths:null, manualAgeOverride:false, referenceAssessmentId:previousAssessment.id, observedResponses:{}, observations:{}, correctionMetadata:{}, workflowStatus:'borrador', createdAt:instant.toISOString(), updatedAt:instant.toISOString(), revision:0, deletedAt:null, deletedBy:null, deletionRevision:null };
}
export function copyObservedResponsesForSubarea({ currentResponses={}, previousObservedResponses={}, itemCodes=[] }) {
  const codes=new Set(itemCodes); const next=Object.fromEntries(Object.entries(currentResponses).filter(([code])=>!codes.has(code)));
  for(const code of itemCodes){const value=previousObservedResponses[code];if(VALID_SCORE.has(value))next[code]=value;} return next;
}
export function restoreResponsesForSubarea({ currentResponses={}, previousCurrentResponses={}, itemCodes=[] }) { return copyObservedResponsesForSubarea({currentResponses,previousObservedResponses:previousCurrentResponses,itemCodes}); }
export function buildPreviousScoreReference({ previousAssessment, items, model, scoreAssessment }) {
  if(!previousAssessment||previousAssessment.deletedAt||!Array.isArray(items)||typeof scoreAssessment!=='function')return null;
  const assessment=structuredClone(previousAssessment); const scoring=scoreAssessment(structuredClone(items),structuredClone(model),structuredClone(assessment.observedResponses??{})); const scores={};
  for(const item of items)scores[item.codigo_canonico]=scorePresentation(scoring.respuestas_efectivas?.[item.codigo_canonico]); return {assessmentId:assessment.id,scores};
}
