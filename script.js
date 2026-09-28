import { loadAndNormalizeItems } from './src/battelle-data.js';
import { loadScaleModel, validateScaleModel } from './src/battelle-scales.js';
import { scoreAssessment } from './src/battelle-scoring.js';
import { runCorrection, inspectCorrection, isCorrectionStale, buildDescriptiveSummary } from './src/battelle-correction.js';
import { buildCorrectionPreflight } from './src/battelle-correction-preflight.js';
import { buildResultTableModel, copyResultTable, createResultPresentation, displayValue, NOT_APPLICABLE, RESULT_COLUMN_DEFINITIONS, RESULT_FORMATS, selectResultColumns } from './src/battelle-result-table.js';
import { downloadBattellePdf } from './src/battelle-pdf.js';
import { loadJson } from './src/battelle-data.js';
import { NORMATIVE_ERROR_MESSAGE, loadNormativeData, validateNormativeData } from './src/battelle-conversions.js';
import { createAssessment, hasAssessmentChanges, calculateAgeMonths, formatAge, LEGACY_KEY, STORAGE_KEY } from './src/battelle-state.js';
import { WORKFLOW_STATUS, COLLECTION_ERROR, classifyAssessment, createAssessmentRecord, filterAssessments } from './src/battelle-assessment-repository.js';
import { signInNeurointegra, observeAuthState, ensureAuthorized, signOutNeurointegra, friendlyAuthError } from './src/battelle-auth.js';
import { createFirestoreAssessmentRepository } from './src/battelle-firestore-repository.js';
import { detectLocalAssessments, importLocalAssessments } from './src/battelle-local-import.js';
import { VIEW_MODE, applyCorrectionResult, workflowFromEvaluationStatus, workflowToEvaluationStatus, reopenCorrected, reopenBlocked } from './src/battelle-assessment-workflow.js';
import { createSaveCoordinator, guardBeforeLeaving } from './src/battelle-save-coordinator.js';
import { scorePresentation, scoreButtonAccessibility } from './src/battelle-score-presentation.js';
import { itemIsInStartingLevel, startingLevelForAge, startingLevelSummary } from './src/battelle-starting-level.js';
import { canonicalTherapistName, sanitizeTherapistName, therapistLabel, therapistSuggestions } from './src/battelle-therapist.js';
import { buildAssessmentComparison } from './src/battelle-comparison.js';
import { buildPreviousScoreReference, copyObservedResponsesForSubarea, createFollowUpAssessmentSeed, restoreResponsesForSubarea } from './src/battelle-follow-up.js';
import { captureAdministrationNavigation, comparisonControls, initialAdministrationLocation, resolveAdministrationLocation } from './src/battelle-navigation.js';
import { showConfirmDialog, showMessageDialog, showToast } from './src/battelle-dialogs.js';
import { buildEquivalentAgeChartModel, renderEquivalentAgeChart, chartPngBlob, downloadChartBlob, copyChartPng, safeChartFilename } from './src/battelle-equivalent-age-chart.js';

const $ = (id) => document.getElementById(id);
const state = { ready:false, items:[], model:null, normativeData:null, normativeValidation:null, assessment:null, score:null, correction:null, evaluationStatus:'administrando', activeArea:'Personal/Social', activeSubarea:null, assessments:[], view:'home', viewMode:VIEW_MODE.ADMINISTRATION, saveTimer:null, saveCoordinator:null, lastSavedAt:null, openedRevision:null, storageError:null, user:null, initializingUid:null, authorizationPromise:null, repository:null, unsubscribeAssessments:null, unsubscribeAssessment:null, remoteConflict:null, remoteDeleted:false, trashMode:false, comparisonMode:false, comparisonIds:[], comparisonModel:null, comparisonContext:'general', comparisonNotice:'', resultTableModel:null, equivalentAgeChartModel:null, resultsDisplay:'table', comparisonDisplay:'table', resultFormatId:'piat', resultColumnSelection:[...RESULT_FORMATS.piat.defaultColumns], previousAssessment:null, previousScoreReference:null, referenceLoadToken:0, subareaUndo:{} };
const scaleOrder = ['personal_social_total','adaptativa_total','motora_gruesa','motora_fina','motora_total','comunicacion_receptiva','comunicacion_expresiva','comunicacion_total','cognitiva_total','battelle_total'];
const areas = ['Personal/Social','Adaptativa','Motora','Comunicación','Cognitiva'];
let lastStartingScrollKey = null;
let correctionConfirmationPending = false;
const assessmentOperations = new Set();
function resetAssessmentNavigation(){
  const location=initialAdministrationLocation(state.items);
  state.activeArea=location.areaId;
  state.activeSubarea=location.subareaId;
  lastStartingScrollKey=null;
}
function el(tag, attrs={}, ...children){ const n=document.createElement(tag); for(const [k,v] of Object.entries(attrs)){ if(k==='class') n.className=v; else if(k.startsWith('aria')) n.setAttribute(k.replace(/[A-Z]/g,m=>'-'+m.toLowerCase()), v); else if(k==='dataset') Object.assign(n.dataset,v); else if(k==='for') n.htmlFor=v; else n[k]=v; } for(const c of children) n.append(c?.nodeType?c:document.createTextNode(String(c))); return n; }
function setText(id, text){ $(id).textContent = text; }

function updateConnectionStatus(text=''){
  if(!$('connectionStatus')) return;
  const offline=!navigator.onLine || state.storageError;
  if(offline) $('connectionStatus').textContent='Sin conexión / cambios pendientes';
  else if(state.user) $('connectionStatus').textContent='● Conectado';
  else $('connectionStatus').textContent='Sin sesión';
}
async function checkLocalImport(){
  const status=detectLocalAssessments();
  $('localImportNotice').classList.toggle('hidden', !status.ok || !status.count || status.completed);
  if(status.ok && status.count) $('localImportText').textContent=`Hay ${status.count} evaluaciones guardadas únicamente en este dispositivo`;
}
async function subscribeRemoteList(){
  if(state.unsubscribeAssessments) state.unsubscribeAssessments();
  state.unsubscribeAssessments=await state.repository.subscribeAssessments((records,meta={})=>{ if(records){ state.assessments=records; if(state.comparisonIds.some(id=>!records.some(record=>record.id===id))){state.comparisonMode=false;state.comparisonIds=[];state.comparisonModel=null;state.comparisonNotice='Una evaluación seleccionada se eliminó remotamente. La comparación se ha cancelado.';if(state.view==='comparison')showHome();} if(state.view==='home') renderHome(records); if(meta.hasPendingWrites) $('saveStatus').textContent='Guardando…'; } else { state.storageError=meta.error; updateConnectionStatus(); } });
}
async function subscribeOpenAssessment(id){
  if(state.unsubscribeAssessment){ state.unsubscribeAssessment(); state.unsubscribeAssessment=null; }
  // La evaluación ya fue obtenida (o creada y confirmada) antes de suscribirse.
  // Así, un primer snapshot inexistente también se reconoce como eliminación.
  let documentWasSeen=true;
  const repository=state.repository;
  state.unsubscribeAssessment=await repository.subscribeAssessment(id,(remote,meta={})=>{
    if(state.repository!==repository || state.assessment?.id!==id) return;
    if(meta.error){ state.storageError=meta.error; updateConnectionStatus(); return; }
    if(meta.hasPendingWrites) return;
    if(remote){
      documentWasSeen=true;
      if(remote.revision>(state.openedRevision ?? 0)){
        if(!state.saveCoordinator?.hasPending()){
          state.saveCoordinator?.cancel(); state.saveCoordinator=null;
          hydrateAssessment(remote);
          return;
        }
        state.remoteConflict=remote;
        $('conflictNotice').querySelector('p').textContent='Esta evaluación fue modificada en otro dispositivo. No se sobrescribirán cambios locales pendientes.';
        $('reloadRemoteBtn').classList.remove('hidden');
        $('keepLocalBtn').classList.remove('hidden');
        $('conflictNotice').classList.remove('hidden');
      }
      return;
    }
    if(!documentWasSeen) return;
    state.remoteDeleted=true;
    state.saveCoordinator?.cancel();
    state.remoteConflict=null;
    $('conflictNotice').querySelector('p').textContent='Esta evaluación ha sido eliminada desde otro dispositivo. Los cambios locales se han detenido y no volverán a crearla.';
    $('reloadRemoteBtn').classList.add('hidden');
    $('keepLocalBtn').classList.add('hidden');
    $('conflictNotice').classList.remove('hidden');
    $('saveStatus').textContent='Evaluación eliminada remotamente.';
  });
}
function showLogin(){ $('loginView').classList.remove('hidden'); $('appShell').classList.add('hidden'); updateConnectionStatus(); }
function showApp(){ $('loginView').classList.add('hidden'); $('appShell').classList.remove('hidden'); updateConnectionStatus(); }
async function handleAuthorizedUser(user){
  if(state.user?.uid===user.uid && state.repository) return state.authorizationPromise || Promise.resolve();
  if(state.initializingUid===user.uid && state.authorizationPromise) return state.authorizationPromise;
  state.initializingUid=user.uid;
  state.authorizationPromise=(async()=>{
    if(state.unsubscribeAssessments){ state.unsubscribeAssessments(); state.unsubscribeAssessments=null; }
    if(state.unsubscribeAssessment){ state.unsubscribeAssessment(); state.unsubscribeAssessment=null; }
    state.user=user; state.repository=createFirestoreAssessmentRepository({user}); showApp(); await initDataOnce(); await subscribeRemoteList(); await checkLocalImport(); showHome();
  })();
  try{ await state.authorizationPromise; } finally { if(state.initializingUid===user.uid) state.initializingUid=null; }
}
async function clearActiveSessionState(){
  if(state.unsubscribeAssessments){ state.unsubscribeAssessments(); state.unsubscribeAssessments=null; } if(state.unsubscribeAssessment){ state.unsubscribeAssessment(); state.unsubscribeAssessment=null; }
  Object.assign(state,{user:null,initializingUid:null,authorizationPromise:null,repository:null,assessment:null,score:null,correction:null,assessments:[],saveCoordinator:null,openedRevision:null,lastSavedAt:null,remoteConflict:null,storageError:null});
}
async function signOutFlow(){
  const result=await flushSave();
  if(result?.ok===false){ const leave=await showConfirmDialog({title:'Cerrar sesión',message:'No se pudieron sincronizar los cambios pendientes. ¿Quieres cerrar sesión perdiendo esos cambios no sincronizados?',confirmLabel:'Cerrar sesión',cancelLabel:'Cancelar',tone:'warning',trigger:$('signOutBtn')}); if(!leave) return; }
  await clearActiveSessionState(); await signOutNeurointegra(); showLogin();
}
async function initDataOnce(){
  if(state.ready) return;
  setText('loadStatus','Cargando datos Battelle…');
  const [items,model,normativeData]=await Promise.all([loadAndNormalizeItems(),loadScaleModel(),loadNormativeData(loadJson)]);
  validateScaleModel(model,items); const normativeValidation=validateNormativeData(normativeData,model);
  Object.assign(state,{ready:true,items,model,normativeData,normativeValidation}); $('homeNewAssessmentBtn').disabled=false;
  if(normativeValidation.ok){ setText('loadStatus',''); $('loadStatus').classList.add('hidden'); }
  else { setText('loadStatus',NORMATIVE_ERROR_MESSAGE); $('loadStatus').classList.remove('hidden'); $('loadStatus').classList.add('load-error'); }
}

function currentAge(){ if (!state.assessment) return null; if (state.assessment.manualAgeOverride) return state.assessment.ageMonths; const r=calculateAgeMonths(state.assessment.birthDate,state.assessment.assessmentDate); return r.ok ? r.months : null; }
function updateAge(){ const a=state.assessment; const r=calculateAgeMonths(a.birthDate,a.assessmentDate); if(!a.manualAgeOverride) a.ageMonths=r.ok?r.months:null; const manualInvalid=a.manualAgeOverride && !Number.isInteger(a.ageMonths); const msg=manualInvalid?'La edad modificada está vacía o fuera de 0–95 meses.':(r.ok||a.manualAgeOverride ? `Edad cronológica: ${formatAge(a.ageMonths)} (${a.ageMonths} meses)` : r.message); setText('ageBandLabel', msg); $('ageMonths').value = a.ageMonths ?? ''; return !manualInvalid && (a.manualAgeOverride ? Number.isInteger(a.ageMonths) : r.ok); }
function snapshotAssessment(){ state.assessment.workflowStatus=toRecordStatus(); return createAssessmentRecord(state.assessment); }
function ensureSaveCoordinator(){
  const assessmentId=state.assessment?.id;
  if(!assessmentId || state.remoteDeleted) return null;
  if(state.saveCoordinator?.assessmentId===assessmentId) return state.saveCoordinator;
  state.saveCoordinator?.cancel();
  const repository=state.repository;
  state.saveCoordinator=createSaveCoordinator({assessmentId,initialRevision:state.openedRevision ?? 0,
    saveSnapshot:(snapshot,expectedRevision)=>repository.saveAssessment(snapshot,expectedRevision),
    applySaved:(saved)=>{ if(state.repository!==repository || state.assessment?.id!==saved.id || state.remoteDeleted) return; state.assessment={...saved,...state.assessment,updatedAt:saved.updatedAt,revision:saved.revision}; state.openedRevision=saved.revision; state.lastSavedAt=saved.updatedAt; state.storageError=null; state.remoteConflict=null; $('conflictNotice').classList.add('hidden'); },
    onError:(err)=>{ if(state.repository!==repository || state.assessment?.id!==assessmentId) return; state.storageError=err; if(err.code===COLLECTION_ERROR.CONFLICT){ state.remoteConflict=err.current ?? state.remoteConflict; $('conflictNotice').classList.remove('hidden'); } },
    onStatus:(text)=>{ if(state.repository!==repository || state.assessment?.id!==assessmentId) return; $('saveStatus').textContent=text==='Guardado.'?'Guardado en Neurointegra':text; updateConnectionStatus(text); }
  });
  return state.saveCoordinator;
}
async function save(){ if(!state.assessment || state.remoteDeleted) return {ok:!state.remoteDeleted,deleted:state.remoteDeleted}; return ensureSaveCoordinator().enqueue(snapshotAssessment()); }
function scheduleSave(delay=0){ if(!state.assessment || state.remoteDeleted) return; ensureSaveCoordinator().schedule(snapshotAssessment(),delay); }
async function flushSave(){ if(!state.assessment) return {ok:true}; if(state.remoteDeleted) return {ok:false,deleted:true}; return ensureSaveCoordinator().flush(snapshotAssessment()); }
function toRecordStatus(){ return workflowFromEvaluationStatus(state.evaluationStatus, state.assessment); }
function fromRecordStatus(s){ return workflowToEvaluationStatus(s); }
function hasBlockingScoreError(){ return (state.correction?.errors ?? []).length > 0; }
function conversionsAllowed(){ return state.evaluationStatus==='corregida' && !hasBlockingScoreError() && updateAge(); }
function provisionalScore(){ state.score=state.assessment ? scoreAssessment(state.items,state.model,state.assessment.observedResponses??{},state.assessment.scoringRulesVersion) : null; }
function resetCorrection(next='administrando', {clearMetadata=false}={}){ provisionalScore(); state.correction=null; state.evaluationStatus=next; state.viewMode=VIEW_MODE.ADMINISTRATION; if(clearMetadata) state.assessment.correctionMetadata={}; updateResults(); updateVisibleItemsEffective(); scheduleSave(); }
function maybeInvalidateCorrection(changedScoringData=true){ if(!changedScoringData){ scheduleSave(300); updateResults(); return; } if(state.assessment?.workflowStatus===WORKFLOW_STATUS.CORRECTED || state.assessment?.correctionMetadata?.fingerprint){ state.correction=null; state.evaluationStatus='resultado_desactualizado'; state.assessment.workflowStatus=WORKFLOW_STATUS.STALE; state.viewMode=VIEW_MODE.ADMINISTRATION; } else if(state.evaluationStatus!=='correccion_bloqueada') state.evaluationStatus='administrando'; provisionalScore(); updateResults(); updateVisibleItemsEffective(); scheduleSave(); }
async function startNew(force=false){
  if(!state.ready) return;

  if(state.assessment){
    const ok = await guardBeforeLeaving({save:flushSave});
    if(!ok) return;
  }

  state.saveCoordinator?.cancel();
  if(state.unsubscribeAssessment){ state.unsubscribeAssessment(); state.unsubscribeAssessment=null; }
  state.saveCoordinator = null;
state.remoteConflict = null;
state.remoteDeleted = false;
state.storageError = null;
$('conflictNotice').classList.add('hidden');

state.assessment = createAssessmentRecord(createAssessment());
  resetAssessmentNavigation();
  state.openedRevision = state.assessment?.revision ?? 0;
  state.score = null;
  state.correction = null;
  state.evaluationStatus = 'administrando';
  state.viewMode = VIEW_MODE.ADMINISTRATION;
  provisionalScore();

  // La evaluación permanece local hasta completar el terapeuta obligatorio.

  showAssessment();
  bindAssessment();
  renderAreas();
  renderItems()