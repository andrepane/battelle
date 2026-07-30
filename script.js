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
import { WORKFLOW_STATUS, COLLECTION_ERROR, createAssessmentRecord, filterAssessments } from './src/battelle-assessment-repository.js';
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
import { captureAdministrationNavigation, comparisonControls, resolveAdministrationLocation } from './src/battelle-navigation.js';
import { showConfirmationDialog } from './src/confirmation-dialog.js';
import { buildEquivalentAgeChartModel, renderEquivalentAgeChart, chartPngBlob, downloadChartBlob, copyChartPng, safeChartFilename } from './src/battelle-equivalent-age-chart.js';

const $ = (id) => document.getElementById(id);
const state = { ready:false, items:[], model:null, normativeData:null, normativeValidation:null, assessment:null, score:null, correction:null, evaluationStatus:'administrando', activeArea:'Personal/Social', activeSubarea:null, assessments:[], view:'home', viewMode:VIEW_MODE.ADMINISTRATION, saveTimer:null, saveCoordinator:null, lastSavedAt:null, openedRevision:null, storageError:null, user:null, initializingUid:null, authorizationPromise:null, repository:null, unsubscribeAssessments:null, unsubscribeAssessment:null, remoteConflict:null, remoteDeleted:false, trashMode:false, comparisonMode:false, comparisonIds:[], comparisonModel:null, comparisonContext:'general', comparisonNotice:'', resultTableModel:null, equivalentAgeChartModel:null, resultsDisplay:'table', comparisonDisplay:'table', includeChartPdf:false, resultFormatId:'piat', resultColumnSelection:[...RESULT_FORMATS.piat.defaultColumns], previousAssessment:null, previousScoreReference:null, referenceLoadToken:0, subareaUndo:{} };
const scaleOrder = ['personal_social_total','adaptativa_total','motora_gruesa','motora_fina','motora_total','comunicacion_receptiva','comunicacion_expresiva','comunicacion_total','cognitiva_total','battelle_total'];
const areas = ['Personal/Social','Adaptativa','Motora','Comunicación','Cognitiva'];
let lastStartingScrollKey = null;
let correctionConfirmationPending = false;
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
  if(result?.ok===false){ const leave=confirm('No se pudieron sincronizar los cambios pendientes. ¿Quieres cerrar sesión perdiendo esos cambios no sincronizados?'); if(!leave) return; }
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
function provisionalScore(){ state.score=state.assessment ? scoreAssessment(state.items,state.model,state.assessment.observedResponses??{}) : null; }
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
  renderItems();
  updateResults();
  $('therapistName').focus();
}
async function loadPreviousReference(assessment){
  const token=++state.referenceLoadToken; state.previousAssessment=null; state.previousScoreReference=null; state.subareaUndo={};
  if(!assessment?.referenceAssessmentId||assessment.referenceAssessmentId===assessment.id)return;
  const previous=await state.repository.getAssessment(assessment.referenceAssessmentId);
  if(token!==state.referenceLoadToken||state.assessment?.id!==assessment.id)return;
  if(!previous||previous.deletedAt){renderItems();updateResults();return;}
  state.previousAssessment=previous;
  state.previousScoreReference=buildPreviousScoreReference({previousAssessment:previous,items:state.items,model:state.model,scoreAssessment});
  renderItems(); updateResults();
}
async function createAssessmentWithReference(){
  const previousId=state.assessment?.id;
  if(!previousId||state.evaluationStatus!=='corregida'||!confirm('Se creará una Battelle nueva e independiente usando esta evaluación únicamente como referencia visual. ¿Continuar?'))return;
  if(!(await guardBeforeLeaving({save:flushSave})))return;
  const previous=await state.repository.getAssessment(previousId);
  if(!previous||previous.workflowStatus!==WORKFLOW_STATUS.CORRECTED){alert('La evaluación anterior ya no está disponible o ha dejado de estar corregida.');return;}
  const blank=createAssessment(); const seed=createAssessmentRecord(createFollowUpAssessmentSeed({previousAssessment:previous,now:new Date(),id:blank.id}));
  const saved=await state.repository.saveAssessment(seed,0);
  state.saveCoordinator?.cancel();state.saveCoordinator=null;if(state.unsubscribeAssessment){state.unsubscribeAssessment();state.unsubscribeAssessment=null;}
  showAssessment();hydrateAssessment(saved);await subscribeOpenAssessment(saved.id);
}
function restoreAdministrationNavigation(snapshot){
  const location=resolveAdministrationLocation({items:state.items,areaId:snapshot.areaId,subareaId:snapshot.subareaId});
  state.activeArea=location.areaId;state.activeSubarea=location.subareaId;renderAreas();renderItems();
  requestAnimationFrame(()=>{const section=[...document.querySelectorAll('.subarea-card')].find(node=>node.dataset.subarea===location.subareaId);if(section)section.open=true;window.scrollTo({top:snapshot.scrollY,behavior:'auto'});const selector=snapshot.action==='undo'?'.undo-previous-subarea':'.copy-previous-subarea';(section?.querySelector(selector)||section?.querySelector('summary'))?.focus();});
}
async function applyPreviousSubarea(subarea,trigger){
  if(!state.previousAssessment)return;const items=state.items.filter(item=>item.area===state.activeArea&&item.subarea===subarea);const codes=items.map(item=>item.codigo_canonico);
  const before=Object.fromEntries(codes.filter(code=>Object.hasOwn(state.assessment.observedResponses,code)).map(code=>[code,state.assessment.observedResponses[code]]));
  const navigation=captureAdministrationNavigation({areaId:state.activeArea,subareaId:subarea,trigger,scrollY:window.scrollY});
  if(!await showConfirmationDialog({title:'Sustituir puntuaciones',message:'Esta subárea ya contiene puntuaciones actuales. Si continúas, se sustituirán por las respuestas observadas de la evaluación anterior.',confirmLabel:'Sustituir puntuaciones',cancelLabel:'Cancelar',tone:'warning',trigger}))return;
  state.subareaUndo[subarea]=before;state.assessment.observedResponses=copyObservedResponsesForSubarea({currentResponses:state.assessment.observedResponses,previousObservedResponses:state.previousAssessment.observedResponses,itemCodes:codes});maybeInvalidateCorrection(true);restoreAdministrationNavigation(navigation);
}
function undoPreviousSubarea(subarea,trigger){const before=state.subareaUndo[subarea];if(!before)return;const navigation=captureAdministrationNavigation({areaId:state.activeArea,subareaId:subarea,trigger,scrollY:window.scrollY});const codes=state.items.filter(item=>item.area===state.activeArea&&item.subarea===subarea).map(item=>item.codigo_canonico);state.assessment.observedResponses=restoreResponsesForSubarea({currentResponses:state.assessment.observedResponses,previousCurrentResponses:before,itemCodes:codes});delete state.subareaUndo[subarea];maybeInvalidateCorrection(true);restoreAdministrationNavigation(navigation);}
function showHome(){ state.view='home'; $('homeView').classList.remove('hidden'); $('assessmentView').classList.add('hidden'); $('comparisonView').classList.add('hidden'); renderHome(); }
function showAssessment(){ state.view='assessment'; $('homeView').classList.add('hidden'); $('comparisonView').classList.add('hidden'); $('assessmentView').classList.remove('hidden'); }
function hydrateAssessment(rec){
  state.assessment=rec; state.openedRevision=rec.revision; state.remoteConflict=null; state.remoteDeleted=false; state.storageError=null;
  state.evaluationStatus=fromRecordStatus(rec.workflowStatus); state.viewMode=rec.workflowStatus===WORKFLOW_STATUS.CORRECTED?VIEW_MODE.RESULTS:VIEW_MODE.ADMINISTRATION; state.score=null; state.correction=null; provisionalScore();
  bindAssessment(); renderAreas(); renderItems();
  if(rec.workflowStatus===WORKFLOW_STATUS.CORRECTED) reconstructCorrectedOnce(); else if(rec.workflowStatus===WORKFLOW_STATUS.BLOCKED) reconstructBlockedOnce(); else { updateResults(); updateVisibleItemsEffective(); }
  if($('correctionPreflightDialog').open) renderPreflight(buildCorrectionPreflight(preflightRunner()));
  void loadPreviousReference(rec);
}
async function openAssessment(id){
  if(state.assessment && state.assessment.id!==id && !(await guardBeforeLeaving({save:flushSave}))) return;
  state.saveCoordinator?.cancel(); state.saveCoordinator=null;
  const rec=await state.repository.getAssessment(id); if(!rec) return;
  showAssessment(); hydrateAssessment(rec); await subscribeOpenAssessment(id);
}
async function reloadRemoteAssessment(){
  const remote=state.remoteConflict; if(!remote || remote.id!==state.assessment?.id) return;
  state.saveCoordinator?.cancel(); state.saveCoordinator=null; hydrateAssessment(remote);
  $('conflictNotice').classList.add('hidden');
}
async function backToHome(){
  const canLeave=state.remoteDeleted || await guardBeforeLeaving({save:flushSave}); if(!canLeave) return;
  state.saveCoordinator?.cancel(); if(state.unsubscribeAssessment){ state.unsubscribeAssessment(); state.unsubscribeAssessment=null; }
  Object.assign(state,{assessment:null,score:null,correction:null,saveCoordinator:null,openedRevision:null,remoteConflict:null,remoteDeleted:false,previousAssessment:null,previousScoreReference:null,referenceLoadToken:state.referenceLoadToken+1,subareaUndo:{}}); showHome();
}
function correctionRunner(){ return runCorrection({assessment:state.assessment,items:state.items,model:state.model,normativeData:state.normativeData,scoreAssessment}); }
function preflightRunner(){ return inspectCorrection({assessment:state.assessment,items:state.items,model:state.model,normativeData:state.normativeData,scoreAssessment}); }
function reconstructCorrectedOnce(){ const reopened=reopenCorrected({assessment:state.assessment, runCorrection:correctionRunner}); Object.assign(state,{assessment:reopened.assessment, correction:reopened.correction, score:reopened.score, viewMode:reopened.viewMode, evaluationStatus:reopened.evaluationStatus}); if(state.evaluationStatus==='resultado_desactualizado') save(); updateResults(); updateVisibleItemsEffective(); }
function reconstructBlockedOnce(){ const reopened=reopenBlocked({assessment:state.assessment, runCorrection:correctionRunner}); Object.assign(state,{assessment:reopened.assessment, correction:reopened.correction, score:reopened.score, viewMode:reopened.viewMode, evaluationStatus:reopened.evaluationStatus}); updateResults(); updateVisibleItemsEffective(); }
function bindAssessment(){ const a=state.assessment; $('patientName').value=a.name; $('therapistName').value=a.therapistName??''; $('therapistError').textContent=''; $('therapistSuggestions').replaceChildren(...therapistSuggestions(state.assessments).map(name=>el('option',{value:name})));  $('birthDate').value=a.birthDate; $('assessmentDate').value=a.assessmentDate; $('manualAgeOverride').checked=!!a.manualAgeOverride; updateAge(); }
function onMeta(e){ const a=state.assessment; if(!a) return; if(e.target.id==='therapistName'){ const canonical=canonicalTherapistName(e.target.value,state.assessments); a.therapistName=canonical; $('therapistError').textContent=canonical?'':'Indica el terapeuta responsable.'; if(canonical) e.target.value=canonical; a.updatedAt=new Date().toISOString(); updateResults(); if(canonical){ const firstSave=(state.openedRevision??0)===0; scheduleSave(300); if(firstSave) void flushSave().then(result=>{ if(result?.ok&&state.assessment?.id===a.id) return subscribeOpenAssessment(a.id); }); } return; } if(e.target.id==='patientName') a.name=e.target.value; if(e.target.id==='birthDate') a.birthDate=e.target.value; if(e.target.id==='assessmentDate') a.assessmentDate=e.target.value; if(e.target.id==='manualAgeOverride'){ a.manualAgeOverride=e.target.checked; if(a.manualAgeOverride && !Number.isInteger(a.ageMonths)){ const r=calculateAgeMonths(a.birthDate,a.assessmentDate); a.ageMonths=r.ok?r.months:null; } } if(e.target.id==='ageMonths'){ a.manualAgeOverride=true; $('manualAgeOverride').checked=true; const v=e.target.value===''?null:Number(e.target.value); a.ageMonths=Number.isInteger(v)&&v>=0&&v<=95?v:null; } a.updatedAt=new Date().toISOString(); updateAge(); maybeInvalidateCorrection(e.target.id!=='patientName'); if(e.target.id!=='patientName') updateStartingLevelVisuals({scroll:true, reason:'age'}); }
function renderAreas(){ const nav=$('areaNav'); nav.replaceChildren(...areas.map(area=>el('button',{class:`area-tab ${area===state.activeArea?'active':''}`, ariaPressed:String(area===state.activeArea), dataset:{area}}, el('span',{},area), el('small',{},state.items.filter(i=>i.area===area).length)))); }
function subareaObservationKey(subarea){ return `subarea:${subarea}`; }
function subareaHeader(subarea, items){ const start=startingLevelSummary(startingLevelForAge(items,currentAge())); const result=Object.values(state.score?.subareas??{}).find((entry)=>entry.area===items[0]?.area&&entry.subarea===subarea); const admin=result?.administracion; const basal=admin?.basal?.confirmado?admin.basal.rango_edad:'pendiente'; const ceiling=admin?.techo?.confirmado&&!admin.techo.provisional?`${admin.techo.inicio}–${admin.techo.fin}`:'pendiente'; const instruction=admin?.instruction ?? 'Administra los ítems indicados para establecer basal y techo.'; return el('div',{class:'subarea-heading'},el('strong',{class:'subarea-title'},subarea),el('div',{class:'subarea-indicators'},el('span',{},`Inicio: ${start}`),el('span',{},`Basal: ${basal}`),el('span',{},`Techo: ${ceiling}`)),el('p',{class:'clinical-instruction'},instruction)); }
function subareaDetails(subarea,items){ const result=Object.values(state.score?.subareas??{}).find((entry)=>entry.area===items[0]?.area&&entry.subarea===subarea); const admin=result?.administracion; const observed=admin?.counts?.observed??items.filter(item=>Object.prototype.hasOwnProperty.call(state.assessment?.observedResponses??{},item.codigo_canonico)).length; return el('details',{class:'administration-details'},el('summary',{},'Detalles de administración'),el('ul',{},el('li',{},`Observados: ${observed}.`),el('li',{},`Derivados por basal: ${admin?.counts?.derivedByBasal??0}.`),el('li',{},`Derivados por techo: ${admin?.counts?.derivedByCeiling??0}.`),el('li',{},`Pendientes efectivos: ${admin?.counts?.pending??items.length-observed}.`))); }

function updateSubareaProgressSummaries(){ for(const summary of document.querySelectorAll('[data-subarea-summary]')){ const sub=summary.dataset.subareaSummary; const items=state.items.filter(item=>item.area===state.activeArea && item.subarea===sub); summary.replaceChildren(subareaHeader(sub,items)); const details=summary.parentElement?.querySelector('.administration-details'); if(details) details.replaceWith(subareaDetails(sub,items)); } }
function renderItems(){ const container=$('itemsContainer'); const bySub=new Map(); for(const item of state.items.filter(i=>i.area===state.activeArea)){ const k=item.subarea; if(!bySub.has(k)) bySub.set(k,[]); bySub.get(k).push(item); } const resolved=resolveAdministrationLocation({items:state.items,areaId:state.activeArea,subareaId:state.activeSubarea}); state.activeArea=resolved.areaId;state.activeSubarea=resolved.subareaId;const sections=[]; for(const [sub, items] of bySub){ sections.push(el('details',{class:'subarea-card', dataset:{subarea:sub}, open:sub===state.activeSubarea}, el('summary',{class:'subarea-summary', dataset:{subareaSummary:sub}}, subareaHeader(sub,items)), subareaDetails(sub,items), ...(state.previousAssessment?[el('div',{class:'reference-subarea-actions'},el('button',{type:'button',class:'secondary-button copy-previous-subarea',dataset:{subarea:sub}},'Mantener puntuaciones anteriores'),el('p',{class:'muted'},'Copia solo respuestas observadas; basal y techo se calcularán de nuevo.'),...(state.subareaUndo[sub]?[el('button',{type:'button',class:'link-button undo-previous-subarea',dataset:{subarea:sub}},'Puntuaciones anteriores aplicadas · Deshacer')]:[]))]:[]), el('div',{class:'item-list'}, ...items.map(renderItemRow)), renderSubareaObservation(sub))); } container.replaceChildren(...sections); updateStartingLevelVisuals(); updateResults(); updateVisibleItemsEffective(); }
function confidenceInfo(value){ if(value==='visual_alta') return {className:'confidence high', label:'Confianza visual alta'}; if(value==='visual_media') return {className:'confidence medium', label:'Confianza visual media'}; return {className:'confidence warn', label:'Revisión visual recomendada'}; }
function renderScoreButtons(item){ const response=state.score?.respuestas_efectivas?.[item.codigo_canonico]; return [null,0,1,2].map(v=>{ const a=scoreButtonAccessibility(item.codigo,v,response); return el('button',{type:'button', class:'score-btn', ariaPressed:String(a.pressed), dataset:{code:item.codigo_canonico, score:v===null?'null':String(v), origin:a.origin}, ariaLabel:a.ariaLabel}, v===null?'—':String(v)); }); }
function renderItemRow(item){ return el('article',{class:'item-card item-row', dataset:{code:item.codigo_canonico, min:item.rango_edad_min_meses, max:item.rango_edad_max_meses}}, el('div',{class:'item-main'}, el('div',{class:'item-head'}, el('strong',{},item.codigo), el('span',{class:'item-age'},`· ${item.rango_edad}`)), el('p',{class:'item-text'},item.enunciado), el('p',{class:'effective hidden', dataset:{effective:item.codigo_canonico}}, 'Puntuación derivada pendiente de corrección')), el('div',{class:'score-column'},...(state.previousScoreReference?[el('span',{class:'previous-score',role:'note',ariaLabel:`Puntuación anterior de ${item.codigo}: ${state.previousScoreReference.scores[item.codigo_canonico]?.label??'—'}`},`Anterior: ${state.previousScoreReference.scores[item.codigo_canonico]?.label??'—'}`)]:[]),el('div',{class:'score-controls', ariaLabel:`Puntuación actual de ${item.codigo}`},...renderScoreButtons(item)))); }
function updateStartingLevelVisuals({scroll=false, reason='render'}={}){ const age=currentAge(); updateSubareaProgressSummaries(); for(const details of document.querySelectorAll('.subarea-card')){ const sub=details.dataset.subarea; const items=state.items.filter((item)=>item.area===state.activeArea&&item.subarea===sub); const level=startingLevelForAge(items,age); details.dataset.startingLevel=level?'true':'false'; details.setAttribute('aria-label',level?`${sub}. Nivel inicial recomendado de ${level.min} a ${level.max} meses.`:`${sub}. Edad necesaria para calcular el inicio.`); details.querySelector('.starting-level-label')?.remove(); const startingItems=items.filter((item)=>itemIsInStartingLevel(item,level)); for(const row of details.querySelectorAll('.item-card')){ const selected=startingItems.some((item)=>item.codigo_canonico===row.dataset.code); row.dataset.startingItem=selected?'true':'false'; row.classList.toggle('starting-item',selected); } const first=startingItems.length?details.querySelector(`[data-code="${startingItems[0].codigo_canonico}"]`):null; if(first){ const label=el('div',{class:'starting-level-label', role:'note', dataset:{startingLevel:'true'}, ariaLabel:`Punto de partida recomendado. Edad cronológica: ${age} meses. Comenzar en el nivel ${level.min} a ${level.max} meses.`}, el('strong',{},`PUNTO DE PARTIDA · Edad cronológica: ${age} meses`), el('span',{},`Comenzar en el nivel ${level.min}–${level.max} meses`)); first.before(label); } if(scroll&&details.open&&first){ const key=`${reason}:${state.assessment?.id}:${age}:${state.activeArea}:${sub}`; if(lastStartingScrollKey!==key){ lastStartingScrollKey=key; requestAnimationFrame(()=>first.scrollIntoView({block:'center',behavior:'smooth'})); } } } }
function renderSubareaObservation(subarea){ const key=subareaObservationKey(subarea); return el('label',{class:'subarea-observation'}, el('span',{},'Observación de la subárea'), el('textarea',{dataset:{obs:key}, value:state.assessment?.observations?.[key] ?? '', rows:3, placeholder:'Observación clínica opcional de esta subárea'})); }
function setObservedScore(button){ if(!sanitizeTherapistName(state.assessment?.therapistName)){ $('therapistError').textContent='Indica el terapeuta responsable antes de introducir puntuaciones.'; $('therapistName').focus(); return; } const code=button.dataset.code; const v=button.dataset.score==='null'?null:Number(button.dataset.score); if(v===null) delete state.assessment.observedResponses[code]; else state.assessment.observedResponses[code]=v; document.querySelectorAll(`.score-btn[data-code="${code}"]`).forEach(b=>b.setAttribute('aria-pressed', String(b===button))); maybeInvalidateCorrection(true); updateSubareaProgressSummaries(); }
function updateVisibleItemsEffective(){ const eff=state.score?.respuestas_efectivas ?? {}; for(const node of document.querySelectorAll('[data-effective]')){ const shown=scorePresentation(eff[node.dataset.effective]); node.classList.remove('hidden'); node.textContent=shown.label; } for(const card of document.querySelectorAll('.item-card')){ const response=eff[card.dataset.code]; const shown=scorePresentation(response); card.dataset.origin=shown.origin; for(const button of card.querySelectorAll('.score-btn')){ const score=button.dataset.score==='null'?null:Number(button.dataset.score); const a=scoreButtonAccessibility(card.dataset.code,score,response); button.setAttribute('aria-pressed',String(a.pressed)); button.setAttribute('aria-label',a.ariaLabel); button.dataset.origin=a.origin; } } }
function statusLabel(){ return {administrando:'En administración',corrigiendo:'En administración',corregida:'Resultado actualizado',resultado_desactualizado:'Cambios pendientes de corregir',correccion_bloqueada:'Revisión necesaria'}[state.evaluationStatus]; }
function observedProgress(){ const total=state.items.length; const answered=Object.keys(state.assessment?.observedResponses??{}).length; return {total, answered, notAdmin:total-answered}; }
function correctEnabled(){ return state.ready && state.normativeValidation?.ok && state.assessment && Boolean(sanitizeTherapistName(state.assessment.therapistName)) && Number.isInteger(currentAge()) && Object.keys(state.assessment.observedResponses??{}).length>0; }
function gotoItem(code){ const item=state.items.find(i=>i.codigo_canonico===code); if(!item) return; state.activeArea=item.area; renderAreas(); renderItems(); setTimeout(()=>{ const card=document.querySelector(`[data-code="${code}"]`); const details=card?.closest('details'); if(details) details.open=true; card?.scrollIntoView({block:'center'}); card?.querySelector('.score-btn[aria-pressed="true"], .score-btn')?.focus(); card?.classList.add('highlight'); setTimeout(()=>card?.classList.remove('highlight'),1800); }, 0); }
function gotoReviewTarget(target){ if(!target)return; if(target.code){gotoItem(target.code);return;} state.activeArea=target.area;renderAreas();renderItems();setTimeout(()=>{const details=[...document.querySelectorAll('.subarea-card')].find(node=>node.dataset.subarea===target.subarea);if(details){details.open=true;details.scrollIntoView({block:'center'});const summary=details.querySelector('summary');summary.tabIndex=-1;summary.focus();details.classList.add('highlight');setTimeout(()=>details.classList.remove('highlight'),1800);}},0); }
function renderPreflight(model){ const dialog=$('correctionPreflightDialog');dialog.dataset.status=model.status;dialog._preflightModel=model;const message={ready:'La evaluación está lista para corregirse.',warnings:'La evaluación puede corregirse, pero contiene advertencias clínicas.',blocked:'La evaluación necesita revisión antes de poder corregirse.'}[model.status];const grouped=(groups,kind)=>el('ul',{class:'preflight-groups'},...groups.map(group=>el('li',{},el('strong',{},`${group.area} — ${group.subarea}`),` — ${group.count} ${kind}.`,group.reasons[0]?` ${group.reasons[0]}`:'')));const detail=model.status==='warnings'?el('details',{class:'preflight-details'},el('summary',{},`Ver advertencias (${model.counts.warnings})`),grouped(model.warnings,'advertencia(s)')):model.status==='blocked'?el('div',{class:'preflight-blockers'},el('p',{},`${model.blockers.length} subáreas o bloques afectados.`),grouped(model.blockers,'problema(s)')):'';const primary=model.status==='blocked'?el('button',{type:'button',id:'preflightReviewBtn',class:'primary-button'},'Ir al primer punto a revisar'):el('button',{type:'button',id:'preflightConfirmBtn',class:'primary-button'},model.status==='warnings'?'Corregir con advertencias':'Corregir Battelle');const secondary=el('button',{type:'button',id:'preflightCancelBtn',class:'secondary-button'},model.status==='ready'?'Volver':model.status==='warnings'?'Volver y revisar':'Cerrar');$('preflightContent').replaceChildren(el('header',{},el('h2',{id:'preflightTitle'},'Resumen antes de corregir'),el('p',{id:'preflightDescription',class:'preflight-message'},message)),el('dl',{class:'preflight-counts'},...Object.entries({'Subáreas listas':`${model.counts.readySubareas} de ${model.counts.totalSubareas}`,'Respuestas observadas':model.counts.observed,'Puntuaciones derivadas por basal':model.counts.derivedByBasal,'Puntuaciones derivadas por techo':model.counts.derivedByCeiling,'Advertencias clínicas':model.counts.warnings,'Problemas que impiden corregir':model.counts.blockers}).flatMap(([label,value])=>[el('dt',{},label),el('dd',{},value)])),detail,el('footer',{class:'preflight-actions'},primary,secondary));if(!dialog.open)dialog.showModal();requestAnimationFrame(()=>primary.focus()); }
function openCorrectionPreflight(){if(correctionConfirmationPending||$('correctionPreflightDialog').open)return;renderPreflight(buildCorrectionPreflight(preflightRunner()));}
function closeCorrectionPreflight(){const dialog=$('correctionPreflightDialog');if(dialog.open)dialog.close();requestAnimationFrame(()=>$('correctBtn')?.focus());}
function confirmPreflight(){const dialog=$('correctionPreflightDialog');if(correctionConfirmationPending||!dialog.open)return;const fresh=buildCorrectionPreflight(preflightRunner());if(!fresh.allowed||fresh.fingerprint!==dialog._preflightModel?.fingerprint){renderPreflight(fresh);return;}correctionConfirmationPending=true;closeCorrectionPreflight();try{runUiCorrection();}finally{correctionConfirmationPending=false;}}
function adminPanel(message='') { const referenceUnavailable=state.assessment?.referenceAssessmentId&&!state.previousAssessment; const p=observedProgress(); const counts=areas.map(area=>({area,count:Object.keys(state.assessment?.observedResponses??{}).filter(code=>state.items.find(item=>item.codigo_canonico===code)?.area===area).length})); return el('section',{class:'summary-card admin-summary'},el('div',{class:'admin-main'},el('p',{class:'admin-status'},`${statusLabel()} · ${p.answered} respuestas observadas`),el('button',{type:'button',id:'correctBtn',class:'primary-button',disabled:!correctEnabled()},'Corregir Battelle')),message?el('p',{class:'warning',role:'status'},message):'',referenceUnavailable?el('p',{class:'notice',role:'status'},'La evaluación anterior utilizada como referencia ya no está disponible.'):'',state.normativeValidation?.ok===false?el('p',{class:'error',role:'alert'},NORMATIVE_ERROR_MESSAGE):'',el('details',{class:'area-progress'},el('summary',{},'Ver progreso por áreas'),el('ul',{},...counts.map(({area,count})=>el('li',{},`${area}: ${count} observadas.`))))); }

function blockedPanel(){ const c=state.correction; const items=c?.pendingReport?.items??[]; return el('section',{class:'error-block', role:'alert'}, el('h2',{},'Revisión necesaria'), el('p',{},'No se muestran resultados hasta resolver los problemas. No se muestran PD válidas ni conversiones.'), el('ul',{},...(c?.errors??[]).map(err=>el('li',{},err.message))), items.length?el('div',{}, el('h3',{},`Ítems pendientes (${items.length})`), el('p',{},`Por área: ${Object.entries(c.pendingReport.byArea).map(([k,v])=>`${k}: ${v}`).join(' · ')}`), el('ul',{},...items.map(p=>el('li',{},`${p.code} · ${p.area} · ${p.subarea} · ${p.ageRange} · ${p.reason} · ${p.statement} `, el('button',{type:'button', class:'link-button goto-item', dataset:{code:p.code}},'Ir al ítem'))))):''); }
function safeText(value, fallback='—'){ if(value===undefined||value===null) return fallback; if(typeof value==='object') return fallback; const text=String(value); return /undefined|null|\[object Object\]/i.test(text)?fallback:text; }
function displayDate(value){ const text=safeText(value,''); const match=/^(\d{4})-(\d{2})-(\d{2})/.exec(text); return match?`${match[3]}/${match[2]}/${match[1]}`:'Sin fecha'; }
function displayDateTime(value){ const date=new Date(value); return Number.isNaN(date.getTime())?'Sin fecha':new Intl.DateTimeFormat('es-ES',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(date); }
function compactAge(months){ if(!Number.isInteger(months)) return 'Sin definir'; if(months<24) return `${months} meses`; const years=Math.floor(months/12),rest=months%12; return rest?`${years} ${years===1?'año':'años'} y ${rest} ${rest===1?'mes':'meses'}`:`${years} ${years===1?'año':'años'}`; }
function patientLabel(value){ const text=safeText(value,'').trim(); return text||'Sin identificar'; }
function showNorm(value, none='—'){ if(!value) return '—'; if(value.ok) return safeText(value.percentile ?? value.centile ?? value.text, '—'); const labels={no_aplicable:'—',fuera_rango_normativo:'Fuera de rango',no_alcanzable:'No alcanzable',error_baremos:'Baremo no encontrado',error_datos:'Error de datos',incompleto:'Incompleto'}; return labels[value.status] ?? labels[value.error?.code] ?? none; }
function technicalHint(value, kind='conversión'){ if(!value) return `${kind}: no aplicable.`; if(value.ok) return `${kind} localizada en ${sourceLine(value)}.`; const code=value.status ?? value.error?.code; const labels={no_aplicable:'Esta conversión no se aplica a esta fila.',escala_no_incluida:'No existe conversión normativa para esta escala.',fuera_rango_normativo:'La PD queda fuera del rango normativo disponible.',pd_fuera_de_rango:'La PD queda fuera del rango normativo disponible.',no_alcanzable:'La PD no es alcanzable según la incidencia normativa.',pd_no_alcanzable:'La PD no es alcanzable según la incidencia normativa.',error_baremos:'No se encontró un baremo único.',baremo_no_encontrado:'No se encontró un baremo único.',error_datos:'Dato no válido para convertir.',pd_invalida:'Dato no válido para convertir.'}; return labels[code] ?? 'Conversión no disponible.'; }
function eqLabel(eq){ if(!eq) return '—'; if(eq.ok) return eq.minMonths===eq.maxMonths?`${eq.text} meses`:eq.text; return '—'; }
function sourceLine(x){ const s=x?.source||x?.provenance; if(!s) return 'Sin procedencia'; const parts=[x.table,s.archivo?.split('/').pop(),s.hoja?`hoja ${s.hoja}`:null,s.celda?`celda ${s.celda}`:null,s.columna?`columna ${s.columna}`:null].filter(Boolean); return parts.length?parts.join(' · '):'Sin procedencia'; }
function td(text, attrs={}){ return el('td',attrs,safeText(text)); }
function pdLabel(s){ const pd=safeText(s?.pd); const max=s?.maximo; return Number.isFinite(max)?`${pd}/${max}`:pd; }
function th(text, attrs={}){ return el('th',attrs,text); }
function metricCard(label,value,attrs={}){ return el('article',{class:'metric-card'}, el('span',{class:'metric-label'},label), el('strong',{...attrs},safeText(value))); }
function info(label,title){ return el('span',{class:'info-chip', title, tabindex:0, ariaLabel:`Información sobre ${label}`},label); }
function compactDetails(counts){ if(!counts) return '—'; const title=`Observadas: ${counts.observed}; derivadas por basal: ${counts.derivedByBasal}; derivadas por techo: ${counts.derivedByCeiling}`; return el('span',{class:'admin-counts',title},`Obs. ${counts.observed} · Basal ${counts.derivedByBasal} · Techo ${counts.derivedByCeiling}`); }
function areaRows(r){ const ids=[['Personal/Social','personal_social_total'],['Adaptativa','adaptativa_total'],['Motora','motora_total'],['Comunicación','comunicacion_total'],['Cognitiva','cognitiva_total']]; return ids.map(([name,id])=>({name,id,s:r.scales[id]})).filter(x=>x.s); }
function needsWarning(s){ return (s.percentile&&!s.percentile.ok&&s.percentile.status!=='no_aplicable')||(s.equivalentAge&&!s.equivalentAge.ok&&s.equivalentAge.error?.code!=='escala_no_incluida'); }
function renderTable(headers, rows, className='results-table'){
  const clinical=className.includes('clinical-results');
  return el('div',{class:'table-wrap'}, el('table',{class:className, ariaLabel:clinical?'Resumen completo de resultados Battelle':undefined}, el('thead',{},el('tr',{},...headers.map(h=>th(h,{scope:'col'})))), el('tbody',{},...rows)));
}
function areaTotalsTable(r){ const rows=areaRows(r); const warn=rows.some(({s})=>needsWarning(s)); return renderTable(['Área','PD','Percentil','Edad equivalente',...(warn?['Aviso']:[])], rows.map(({name,s})=>el('tr',{}, td(name), td(pdLabel(s),{class:'num'}), td(showNorm(s.percentile),{class:'num',title:technicalHint(s.percentile,'Percentil')}), td(eqLabel(s.equivalentAge),{class:'num',title:technicalHint(s.equivalentAge,'Edad equivalente')}), ...(warn?[td(needsWarning(s)?technicalHint(s.equivalentAge&&!s.equivalentAge.ok?s.equivalentAge:s.percentile,'Aviso'):'—')]:[])))); }
function subareaSections(r){ const aggregateByArea={Motora:['motora_gruesa','motora_fina'],Comunicación:['comunicacion_receptiva','comunicacion_expresiva']}; return areas.map(area=>{ const subs=Object.values(r.subareas).filter(s=>s.area===area).sort((a,b)=>(a.subarea||'').localeCompare(b.subarea||'')); const aggs=(aggregateByArea[area]??[]).map(id=>r.scales[id]).filter(Boolean).map(s=>({...s, subarea:s.name, aggregate:true})); const rows=[...subs,...aggs].map(s=>el('tr',{}, td(s.aggregate?`${s.subarea} (agregado)`:s.subarea), td(pdLabel(s),{class:'num'}), td(showNorm(s.percentile),{class:'num',title:technicalHint(s.percentile,'Percentil')}), td(eqLabel(s.equivalentAge),{class:'num',title:technicalHint(s.equivalentAge,'Edad equivalente')}), el('td',{},compactDetails(s.counts)))); return el('details',{class:'subarea-section'}, el('summary',{},`${area} · ${subs.length} subáreas${aggs.length?` · ${aggs.length} agregados`:''}`), renderTable(['Subárea o agregado','PD','Percentil','Edad equivalente','Administración'], rows, 'results-table compact')); }); }
function provenanceBlock(r){ const entries=[r.summary.totalCentile,r.summary.generalConversion,r.summary.totalEquivalentAge,...Object.values(r.scales).flatMap(s=>[s.percentile,s.equivalentAge].filter(Boolean)),...Object.values(r.subareas).flatMap(s=>[s.percentile].filter(Boolean))].filter(Boolean); const unique=[...new Map(entries.map(x=>[sourceLine(x),x])).values()]; return el('details',{class:'technical-block'}, el('summary',{},'Información técnica y procedencia normativa'), el('p',{},`Versión normativa: ${safeText(r.normative.version)} · ${safeText(r.normative.id)}`), el('ul',{},...unique.map(x=>el('li',{},sourceLine(x))))); }
function resultCell(v){ return td(displayValue(v),{class:'num',title:v===NOT_APPLICABLE?'Conversión no aplicable para esta escala':''}); }
function clinicalWarnings(warnings){ if(!warnings.length) return ''; return el('section',{class:'clinical-warnings'},el('h3',{},'Advertencias clínicas'),el('p',{class:'muted'},'Estas advertencias no bloquean la corrección.'),el('ul',{},...warnings.map(w=>el('li',{},el('strong',{},`${w.item}: `),w.message)))); }
function columnControls(){return el('section',{class:'table-customizer',ariaLabel:'Personalizar tabla'},el('div',{class:'customizer-heading'},el('h3',{},'Personalizar tabla')),el('fieldset',{},el('legend',{},'Resultados incluidos'),...Object.values(RESULT_FORMATS).map(format=>el('label',{class:'column-option'},el('input',{type:'radio',name:'result-format',class:'result-format-toggle',value:format.id,checked:state.resultFormatId===format.id}),format.label))),el('fieldset',{},el('legend',{},'Columnas visibles'),...RESULT_COLUMN_DEFINITIONS.map(column=>el('label',{class:'column-option'},el('input',{type:'checkbox',class:'result-column-toggle',dataset:{columnId:column.id},checked:state.resultColumnSelection.includes(column.id),disabled:column.required,ariaLabel:`Mostrar columna ${column.label}`}),column.id==='label'?(state.resultFormatId==='complete'?'Área/subárea':'Área'):column.label))));}
async function copyText(text,statusId,success){const status=$(statusId);try{await navigator.clipboard.writeText(text);status.textContent=success;}catch{status.textContent='No se pudo acceder al portapapeles. Selecciona y copia el contenido manualmente.';}}
function chartActions(model){return el('div',{class:'chart-actions'},el('button',{type:'button',class:'secondary-button copy-chart'},'Copiar gráfico'),el('button',{type:'button',class:'secondary-button download-chart'},'Descargar PNG'),el('span',{class:'chart-copy-status copy-status',role:'status',ariaLive:'polite'}));}
function chartPanel(model){const host=el('section',{class:'equivalent-age-chart-panel',dataset:{chartKind:model.kind}},el('header',{class:'chart-panel-header'},el('div',{},el('h3',{},model.title),el('p',{class:'muted'},'Visualización descriptiva de resultados normativos ya calculados.')),chartActions(model)),el('div',{class:'chart-host'}));renderEquivalentAgeChart(host.querySelector('.chart-host'),model);return host;}
function resultsView(){
  const r=state.correction.results;
  const base=buildResultTableModel({results:r,model:state.model,normativeData:state.normativeData,therapistName:state.assessment?.therapistName}); const conclusion=buildDescriptiveSummary({results:r}); const model=createResultPresentation(Object.freeze({...base,conclusion}),{formatId:state.resultFormatId,columns:state.resultColumnSelection}); state.resultTableModel=model;
  const chartAvailable=Boolean(RESULT_FORMATS[state.resultFormatId]?.rowIds); state.equivalentAgeChartModel=chartAvailable?buildEquivalentAgeChartModel({assessments:[{assessment:state.assessment,model}],formatId:state.resultFormatId,patient:state.assessment?.name,title:'Edades equivalentes Battelle'}):null;
  if(!chartAvailable)state.resultsDisplay='table';
  const columns=model.columns; const rows=model.rows.map(row=>el('tr',{class:`result-row ${row.type}`,ariaLabel:row.type==='grand-total'?'Total Battelle':row.type==='total'?`Total ${row.canonicalLabel}`:undefined},...columns.map((column,index)=>index===0?el('th',{scope:'row'},displayValue(row[column.value])):resultCell(row[column.value]))));
  return el('section',{class:'results-view'},
    el('header',{class:'clinical-header'},el('div',{},el('p',{class:'eyebrow'},'Neurointegra'),el('h2',{},'Resumen de resultados Battelle')),el('div',{class:'results-actions'},el('button',{type:'button',id:'editScoresBtn',class:'secondary-button'},'Editar puntuaciones'),el('button',{type:'button',id:'newWithReferenceBtn',class:'secondary-button'},'Administrar nueva Battelle con referencia anterior'),...(state.assessment?.referenceAssessmentId&&state.previousAssessment?.workflowStatus===WORKFLOW_STATUS.CORRECTED?[el('button',{type:'button',id:'comparePreviousBtn',class:'secondary-button'},'Comparar con la evaluación anterior')]:[]),el('button',{type:'button',id:'copyTableBtn',class:'secondary-button'},'Copiar tabla'),el('button',{type:'button',id:'downloadPdfBtn',class:'primary-button'},'Descargar PDF'),el('span',{id:'tableCopyStatus',class:'copy-status',role:'status',ariaLive:'polite'}))),
    el('dl',{class:'clinical-metadata'},el('div',{},el('dt',{},'Paciente'),el('dd',{},patientLabel(model.metadata.name))),el('div',{},el('dt',{},'Fecha de nacimiento'),el('dd',{},model.metadata.display.birthDate)),el('div',{},el('dt',{},'Fecha de evaluación'),el('dd',{},model.metadata.display.assessmentDate)),el('div',{},el('dt',{},'Edad cronológica'),el('dd',{},model.metadata.display.age)),el('div',{},el('dt',{},'Fecha de corrección'),el('dd',{},model.metadata.display.correctedAt)),el('div',{class:'professional-metadata'},el('dt',{},'Terapeuta'),el('dd',{},model.metadata.display.therapistName))),
    columnControls(),el('nav',{class:'result-display-tabs',ariaLabel:'Vista de resultados'},el('button',{type:'button',class:'secondary-button result-display-toggle',dataset:{display:'table'},ariaPressed:state.resultsDisplay==='table'},'Tabla'),el('button',{type:'button',class:'secondary-button result-display-toggle',dataset:{display:'chart'},ariaPressed:state.resultsDisplay==='chart',disabled:!chartAvailable},'Gráfico')),
    ...(state.resultsDisplay==='chart'&&state.equivalentAgeChartModel?[chartPanel(state.equivalentAgeChartModel)]:[renderTable(columns.map(column=>column.label),rows,'results-table clinical-results')]),
    el('label',{class:'include-chart-pdf checkbox'},el('input',{type:'checkbox',id:'includeChartPdf',checked:state.includeChartPdf,disabled:true}),' Incluir gráfico en PDF ',el('small',{class:'muted'},'(preparado para una versión posterior; desactivado por defecto)')),clinicalWarnings(model.warnings),
    el('section',{class:'descriptive-conclusion'},el('div',{class:'conclusion-heading'},el('h3',{},'Conclusión descriptiva'),el('button',{type:'button',id:'copyConclusionBtn',class:'secondary-button'},'Copiar conclusión')),el('p',{id:'descriptiveConclusion'},conclusion.text),el('p',{class:'conclusion-note'},conclusion.note),el('p',{id:'conclusionCopyStatus',class:'copy-status',role:'status',ariaLive:'polite'})),
    el('details',{class:'technical-block'},el('summary',{},'Detalles técnicos'),el('p',{class:'muted'},'Información técnica y procedencia normativa conservada para auditoría. No se incluye en el PDF.')));
}
function updateResults(){
  const panel=$('resultsPanel'); const corrected=state.evaluationStatus==='corregida' && state.viewMode===VIEW_MODE.RESULTS && state.correction && !isCorrectionStale({assessment:state.assessment, correction:state.correction});
  const assessmentView=$('assessmentView'); assessmentView.classList.toggle('results-mode',Boolean(corrected)); assessmentView.dataset.viewMode=corrected?'results':'administration';
  assessmentView.querySelector('.patient-card')?.classList.toggle('hidden',Boolean(corrected)); $('areaNav').classList.toggle('hidden',Boolean(corrected)); $('itemsContainer').classList.toggle('hidden',Boolean(corrected)); $('viewCrumb').textContent=corrected?'Resultados Battelle':'Administración Battelle';
  if(!state.assessment){ panel.replaceChildren(); return; } if(corrected) panel.replaceChildren(resultsView()); else if(state.evaluationStatus==='correccion_bloqueada') panel.replaceChildren(adminPanel(), blockedPanel()); else if(state.evaluationStatus==='resultado_desactualizado') panel.replaceChildren(adminPanel('La evaluación ha cambiado. Vuelve a pulsar Corregir Battelle.')); else panel.replaceChildren(adminPanel());
}
function runUiCorrection(){ state.evaluationStatus='corrigiendo'; updateResults(); const result=correctionRunner(); state.correction=result; state.score=result.ok?result.scoring:null; state.evaluationStatus=result.status; state.assessment=applyCorrectionResult({assessment:state.assessment,result}); state.viewMode=result.ok?VIEW_MODE.RESULTS:VIEW_MODE.ADMINISTRATION; updateResults(); updateVisibleItemsEffective(); scheduleSave(); }
function setComparisonMode(enabled, notice=''){
  state.comparisonContext='general';state.comparisonMode=enabled; state.comparisonIds=[]; state.comparisonModel=null; state.comparisonNotice=notice;
  $('comparisonBar').classList.toggle('hidden',!enabled); $('comparisonNotice').classList.toggle('hidden',!notice); $('comparisonNotice').textContent=notice;
  renderHome();
}
function comparisonMetadata(title,assessment,model){
  return el('section',{class:'comparison-assessment'},el('h3',{},title),el('dl',{class:'clinical-metadata'},
    el('div',{},el('dt',{},'Paciente'),el('dd',{},patientLabel(assessment.name))),
    el('div',{},el('dt',{},'Fecha de nacimiento'),el('dd',{},model.metadata.display.birthDate)),
    el('div',{},el('dt',{},'Fecha de evaluación'),el('dd',{},model.metadata.display.assessmentDate)),
    el('div',{},el('dt',{},'Edad cronológica'),el('dd',{},model.metadata.display.age)),
    el('div',{},el('dt',{},'Terapeuta'),el('dd',{},model.metadata.display.therapistName))));
}
function renderComparison(model){
  const labels=model.sameDate?['Evaluación A','Evaluación B']:['Evaluación anterior','Evaluación actual'];
  const rows=model.rows.map(row=>el('tr',{class:`result-row ${row.type}`},el('th',{scope:'row'},row.label),resultCell(row.previousPd),resultCell(row.currentPd),resultCell(row.previousEquivalentAge),resultCell(row.currentEquivalentAge)));
  const chartModel=buildEquivalentAgeChartModel({assessments:model.models.map((result,index)=>({assessment:model.assessments[index],model:result,label:labels[index].replace('Evaluación ', '')})),formatId:'piat',patient:model.assessments[1]?.name,title:'Comparación de edades equivalentes Battelle'});state.equivalentAgeChartModel=chartModel;
  const content=state.comparisonDisplay==='chart'?chartPanel(chartModel):state.comparisonDisplay==='series'?el('section',{class:'comparison-series',ariaLabel:'Series comparadas'},...chartModel.series.map(series=>el('p',{},el('strong',{},series.label),` · Edad cronológica: ${Number.isFinite(series.chronologicalAge)?`${series.chronologicalAge} meses`:'—'}`))):renderTable(['Área','PD anterior','PD actual','Edad equivalente anterior','Edad equivalente actual'],rows,'results-table clinical-results comparison-table');
  $('comparisonContent').replaceChildren(
    ...(model.identifyingDataDiffer?[el('p',{class:'notice comparison-warning',role:'alert'},'Los datos identificativos de las evaluaciones seleccionadas no coinciden completamente. Comprueba que pertenecen al mismo paciente.')]:[]),
    el('div',{class:'comparison-metadata'},comparisonMetadata(labels[0],model.assessments[0],model.models[0]),comparisonMetadata(labels[1],model.assessments[1],model.models[1])),
    ...(model.sameDate?[el('p',{class:'muted'},'Ambas evaluaciones tienen la misma fecha; se muestran en orden determinista por ID.')]:[]),
    el('p',{class:'comparison-interval'},el('strong',{},'Tiempo entre evaluaciones: '),model.monthsBetween===null?'—':`${model.monthsBetween} meses`),
    el('nav',{class:'result-display-tabs',ariaLabel:'Vista de comparación'},el('button',{type:'button',class:'secondary-button comparison-display-toggle',dataset:{display:'table'},ariaPressed:state.comparisonDisplay==='table'},'Tabla comparativa'),el('button',{type:'button',class:'secondary-button comparison-display-toggle',dataset:{display:'chart'},ariaPressed:state.comparisonDisplay==='chart'},'Gráfico comparativo'),el('button',{type:'button',class:'secondary-button comparison-display-toggle',dataset:{display:'series'},ariaPressed:state.comparisonDisplay==='series'},'Series')),
    content);
}
async function viewSelectedComparison(context='general'){
  state.comparisonContext=context;const controls=comparisonControls(context);$('backToResultsBtn').classList.toggle('hidden',!controls.backToResults);$('changeComparisonBtn').classList.toggle('hidden',!controls.changeSelection);
  if(state.comparisonIds.length!==2)return;
  const records=await Promise.all(state.comparisonIds.map(id=>state.repository.getAssessment(id)));
  if(records.some(record=>!record)||records.some(record=>record.workflowStatus!==WORKFLOW_STATUS.CORRECTED)||records[0].id===records[1].id){if(context==='reference'){showAssessment();updateResults();return;}setComparisonMode(false,'Una evaluación seleccionada ya no existe o ha dejado de estar corregida. Selecciona de nuevo.');return;}
  try{state.comparisonModel=buildAssessmentComparison({firstAssessment:records[0],secondAssessment:records[1],items:state.items,model:state.model,normativeData:state.normativeData,scoreAssessment});}
  catch(error){state.comparisonMode=false;state.comparisonIds=[];$('homeView').classList.add('hidden');$('assessmentView').classList.add('hidden');$('comparisonView').classList.remove('hidden');$('comparisonContent').replaceChildren(el('p',{class:'notice',role:'alert'},error.message),el('p',{class:'muted'},'No se ha modificado ninguna evaluación.'));return;}
  state.view='comparison'; $('homeView').classList.add('hidden'); $('assessmentView').classList.add('hidden'); $('comparisonView').classList.remove('hidden'); renderComparison(state.comparisonModel);
}
async function renderHome(preloaded=null){
  $('comparisonNotice').classList.toggle('hidden',!state.comparisonNotice); $('comparisonNotice').textContent=state.comparisonNotice;
  const active=preloaded||await state.repository.listAssessments(); state.assessments=active;
  const records=state.trashMode?await state.repository.listDeletedAssessments():active;
  const suggestions=therapistSuggestions(records); const selectedTherapist=$('therapistFilter').value; $('therapistFilter').replaceChildren(el('option',{value:'all'},'Todos'),el('option',{value:'unassigned'},'Sin asignar'),...suggestions.map(name=>el('option',{value:name},name))); if([...$('therapistFilter').options].some(option=>option.value===selectedTherapist)) $('therapistFilter').value=selectedTherapist;
  const filtered=filterAssessments(records,{query:$('assessmentSearch')?.value||'',filter:state.trashMode?'all':$('assessmentFilter')?.value||'all',therapist:$('therapistFilter')?.value||'all'});
  $('savedTitle').textContent=state.trashMode?'Papelera':'Evaluaciones'; $('trashBtn').textContent=state.trashMode?'Volver a evaluaciones':'Papelera'; $('assessmentFilter').closest('label').classList.toggle('hidden',state.trashMode); $('homeNewAssessmentBtn').classList.toggle('hidden',state.trashMode);
  $('compareBattelleBtn').classList.toggle('hidden',state.trashMode||state.comparisonMode); $('trashBtn').classList.toggle('hidden',state.comparisonMode); $('homeNewAssessmentBtn').classList.toggle('hidden',state.trashMode||state.comparisonMode); $('comparisonBar').classList.toggle('hidden',!state.comparisonMode);
  $('comparisonSelectionCount').textContent=`${state.comparisonIds.length} de 2 seleccionadas`; $('viewComparisonBtn').disabled=state.comparisonIds.length!==2;
  const filtering=Boolean(($('assessmentSearch')?.value||'').trim())||(!state.trashMode&&$('assessmentFilter')?.value!=='all')||$('therapistFilter')?.value!=='all'; $('assessmentCount').textContent=filtering?`${filtered.length} de ${records.length} evaluaciones`:`${records.length} ${state.trashMode?'eliminadas':'evaluaciones'}`;
  const host=$('assessmentsList'); if(!filtered.length){host.replaceChildren(el('p',{class:'empty-state'},state.trashMode?'La papelera está vacía.':(filtering?'No se encontraron evaluaciones.':'No hay evaluaciones todavía.')));return;}
  const labels={borrador:'Borrador',pendiente_completar:'Pendiente',correccion_bloqueada:'Pendiente',corregida:'Corregida',resultado_desactualizado:'Resultado desactualizado'};
  let rows;
  if(state.trashMode){
    rows=filtered.map(r=>el('tr',{},
      td(patientLabel(r.name),{dataset:{label:'Paciente'}}),
      td(therapistLabel(r.therapistName),{dataset:{label:'Terapeuta'}}),
      td(displayDate(r.assessmentDate)),
      td(labels[r.workflowStatus]||r.workflowStatus),
      td(displayDateTime(r.deletedAt)),
      td(r.deletedBy||'Usuario autenticado'),
      el('td',{class:'actions'},
        el('button',{class:'secondary-button restore-assessment',dataset:{id:r.id}},'Restaurar'),
        el('button',{class:'danger-button purge-assessment',dataset:{id:r.id}},'Eliminar definitivamente')
      )
    ));
  }else{
    rows=filtered.map(r=>{const corrected=r.workflowStatus===WORKFLOW_STATUS.CORRECTED,selected=state.comparisonIds.includes(r.id),limitReached=state.comparisonIds.length===2&&!selected;return el('tr',{class:selected?'comparison-selected':''},
      ...(state.comparisonMode?[el('td',{class:'comparison-select',dataset:{label:'Seleccionar'}},el('input',{type:'checkbox',class:'comparison-checkbox',dataset:{id:r.id},checked:selected,disabled:!corrected||limitReached,ariaLabel:`Seleccionar ${patientLabel(r.name)}`}))]:[]),
      td(patientLabel(r.name),{dataset:{label:'Paciente'}}),
      td(therapistLabel(r.therapistName),{dataset:{label:'Terapeuta'}}),
      td(displayDate(r.birthDate)),
      td(displayDate(r.assessmentDate)),
      el('td',{title:Number.isInteger(r.ageMonths)?`${r.ageMonths} meses`:''},compactAge(r.ageMonths)),
      el('td',{},el('span',{class:'status-pill'},labels[r.workflowStatus]||r.workflowStatus)),
      td(displayDateTime(r.updatedAt)),
      state.comparisonMode?td('—',{class:'actions'}):el('td',{class:'actions'},el('button',{class:'secondary-button open-assessment',dataset:{id:r.id}},'Abrir'),el('button',{class:'danger-button delete-assessment',dataset:{id:r.id}},'Mover a la papelera'))
    );});
  }
  const normalHeaders=['Paciente','Terapeuta','Nacimiento','Evaluación','Edad','Estado','Última modificación','Acciones']; if(state.comparisonMode) normalHeaders.unshift('Seleccionar');
  host.replaceChildren(renderTable(state.trashMode?['Paciente','Terapeuta','Evaluación','Estado anterior','Eliminada','Usuario','Acciones']:normalHeaders,rows,'assessments-table'));
}
async function removeAssessment(id){ const rec=await state.repository.getAssessment(id); if(!rec) return; const ok=confirm(`Eliminar ${patientLabel(rec.name)} · evaluación ${displayDate(rec.assessmentDate)}. La evaluación se moverá a la papelera y podrá restaurarse.`); if(!ok) return; try{ await state.repository.deleteAssessment(id, rec.revision); $('saveStatus').textContent='Evaluación eliminada.'; }catch(err){ $('saveStatus').textContent=err.code===COLLECTION_ERROR.CONFLICT?'Conflicto: la evaluación cambió antes de eliminar.':'Error al eliminar.'; } await renderHome(); }
async function init(){ showLogin(); try{ await observeAuthState(async(user)=>{ if(!user){ await clearActiveSessionState(); showLogin(); return; } try{ const authorized=await ensureAuthorized(user); await handleAuthorizedUser(authorized); }catch(err){ $('loginMessage').textContent=friendlyAuthError(err); await signOutNeurointegra(); showLogin(); } }); }catch(err){ $('loginMessage').textContent=friendlyAuthError(err); }}
async function restoreDeleted(id){const rec=(await state.repository.listDeletedAssessments()).find(r=>r.id===id);if(!rec||!confirm(`¿Restaurar ${patientLabel(rec.name)}?`))return;try{await state.repository.restoreAssessment(id,rec.revision);await renderHome();}catch{$('saveStatus').textContent='Conflicto: no se pudo restaurar.';}}
async function purgeDeleted(id){const rec=(await state.repository.listDeletedAssessments()).find(r=>r.id===id);if(!rec)return;if(!confirm('ELIMINACIÓN DEFINITIVA: no podrá restaurarse desde la aplicación. ¿Continuar?'))return;if(!confirm(`Confirma de nuevo la eliminación definitiva de ${patientLabel(rec.name)}.`))return;state.saveCoordinator?.cancel();if(state.unsubscribeAssessment){state.unsubscribeAssessment();state.unsubscribeAssessment=null;}try{await state.repository.permanentlyDeleteAssessment(id,rec.revision);await renderHome();}catch{$('saveStatus').textContent='Conflicto: no se eliminó definitivamente.';}}

document.addEventListener('click',async (e)=>{ if(e.target.matches('.result-display-toggle')){state.resultsDisplay=e.target.dataset.display;updateResults();return;} if(e.target.matches('.comparison-display-toggle')){state.comparisonDisplay=e.target.dataset.display;renderComparison(state.comparisonModel);return;} if(e.target.matches('.copy-chart,.download-chart')){const panel=e.target.closest('.equivalent-age-chart-panel'),svg=panel?.querySelector('svg'),status=panel?.querySelector('.chart-copy-status'),model=state.equivalentAgeChartModel;if(!svg||!model)return;try{const blob=await chartPngBlob(svg);if(e.target.matches('.download-chart')){downloadChartBlob(blob,safeChartFilename(model));status.textContent='PNG descargado.';}else{try{await copyChartPng(blob);status.textContent='Gráfico copiado como imagen.';}catch{downloadChartBlob(blob,safeChartFilename(model));status.textContent='No se pudo copiar la imagen; se descargó el PNG.';}}}catch{status.textContent='No se pudo generar la imagen.';}return;} if(e.target.id==='newWithReferenceBtn')await createAssessmentWithReference(); if(e.target.id==='comparePreviousBtn'){state.comparisonIds=[state.assessment.referenceAssessmentId,state.assessment.id];await viewSelectedComparison('reference');} if(e.target.matches('.copy-previous-subarea'))await applyPreviousSubarea(e.target.dataset.subarea,e.target); if(e.target.matches('.undo-previous-subarea'))undoPreviousSubarea(e.target.dataset.subarea,e.target); if(e.target.id==='compareBattelleBtn') setComparisonMode(true); if(e.target.id==='cancelComparisonBtn') setComparisonMode(false); if(e.target.id==='viewComparisonBtn') await viewSelectedComparison('general'); if(e.target.id==='backToResultsBtn'){state.comparisonIds=[];state.comparisonModel=null;showAssessment();updateResults();} if(e.target.id==='backFromComparisonBtn'){state.comparisonMode=false;state.comparisonIds=[];state.comparisonModel=null;showHome();} if(e.target.id==='changeComparisonBtn'){state.comparisonMode=true;state.comparisonIds=[];state.comparisonModel=null;showHome();} if(e.target.id==='homeNewAssessmentBtn') await startNew(); if(e.target.id==='backToHomeBtn') await backToHome(); if(e.target.id==='signOutBtn') await signOutFlow(); if(e.target.id==='reloadRemoteBtn') await reloadRemoteAssessment(); if(e.target.id==='keepLocalBtn') $('conflictNotice').classList.add('hidden'); if(e.target.id==='importLocalBtn'){ const r=await importLocalAssessments({repository:state.repository}); $('importLocalResult').textContent=`Importadas: ${r.imported}; omitidas: ${r.skipped}; inválidas: ${r.invalid}; conflictivas: ${r.conflicts}.`; await checkLocalImport(); } if(e.target.id==='trashBtn'){state.trashMode=!state.trashMode;await renderHome();} if(e.target.matches('.restore-assessment')) await restoreDeleted(e.target.dataset.id); if(e.target.matches('.purge-assessment')) await purgeDeleted(e.target.dataset.id); if(e.target.matches('.open-assessment')) await openAssessment(e.target.dataset.id); if(e.target.matches('.delete-assessment')) await removeAssessment(e.target.dataset.id); if(e.target.id==='discardLegacyBtn'){ localStorage.removeItem(LEGACY_KEY); localStorage.setItem('battelleAssessmentsV3:migratedV2','done'); $('legacyNotice').classList.add('hidden'); } if(e.target.id==='discardDraftBtn'){ localStorage.removeItem(STORAGE_KEY); $('draftNotice').classList.add('hidden'); await startNew(true); } if(e.target.id==='discardInvalidBtn'){ localStorage.removeItem(STORAGE_KEY); await startNew(true); } if(e.target.id==='correctBtn') openCorrectionPreflight(); if(e.target.id==='preflightCancelBtn') closeCorrectionPreflight(); if(e.target.id==='preflightConfirmBtn') confirmPreflight(); if(e.target.id==='preflightReviewBtn'){const target=$('correctionPreflightDialog')._preflightModel?.firstReviewTarget;closeCorrectionPreflight();gotoReviewTarget(target);} if(e.target.id==='downloadPdfBtn' && state.resultTableModel) downloadBattellePdf(state.resultTableModel); if(e.target.id==='copyTableBtn'&&state.resultTableModel){const status=$('tableCopyStatus');try{const mode=await copyResultTable(state.resultTableModel);status.textContent=mode==='formatted'?'Tabla copiada con formato':'Tabla copiada como texto';}catch{status.textContent='No se pudo copiar automáticamente. Selecciona la tabla y cópiala manualmente.';}} if(e.target.id==='copyConclusionBtn'&&state.resultTableModel) await copyText(state.resultTableModel.conclusion.text,'conclusionCopyStatus','Conclusión copiada'); if(e.target.id==='editScoresBtn'){ state.viewMode=VIEW_MODE.ADMINISTRATION; updateResults(); updateVisibleItemsEffective(); } if(e.target.matches('.goto-item')) gotoItem(e.target.dataset.code); if(e.target.matches('.area-tab')){ state.activeArea=e.target.dataset.area;state.activeSubarea=null;renderAreas();renderItems(); } if(e.target.matches('.score-btn')) setObservedScore(e.target);});
document.addEventListener('input',(e)=>{ if(['assessmentSearch'].includes(e.target.id)) renderHome(); if(['patientName','birthDate','assessmentDate','ageMonths'].includes(e.target.id)) onMeta(e); if(e.target.matches('textarea[data-obs]')){ state.assessment.observations[e.target.dataset.obs]=e.target.value; maybeInvalidateCorrection(false); }});
document.addEventListener('keydown',(e)=>{ if(!e.target.matches('.score-btn')) return; if(['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName) || e.target.isContentEditable) return; const row=e.target.closest('.item-card'); const scoreMap={0:'0',1:'1',2:'2',n:'null',N:'null',Delete:'null',Backspace:'null'}; if(Object.prototype.hasOwnProperty.call(scoreMap,e.key)){ e.preventDefault(); const btn=row?.querySelector(`.score-btn[data-score="${scoreMap[e.key]}"]`); if(btn) setObservedScore(btn); return; } if(e.key==='ArrowDown' || e.key==='ArrowUp'){ e.preventDefault(); const rows=[...document.querySelectorAll('.item-card')]; const current=rows.indexOf(row); const next=rows[current + (e.key==='ArrowDown'?1:-1)]; const score=e.target.dataset.score; (next?.querySelector(`.score-btn[data-score="${score}"]`) || next?.querySelector('.score-btn'))?.focus(); } }); document.addEventListener('change',(e)=>{ if(e.target.matches('.comparison-checkbox')){const id=e.target.dataset.id;const selected=new Set(state.comparisonIds);e.target.checked?selected.add(id):selected.delete(id);state.comparisonIds=[...selected].slice(0,2);renderHome();} if(['assessmentFilter','therapistFilter'].includes(e.target.id)) renderHome(); if(e.target.id==='therapistName') onMeta(e); if(e.target.id==='manualAgeOverride') onMeta(e); if(e.target.matches('.result-format-toggle')){state.resultFormatId=e.target.value;state.resultColumnSelection=[...RESULT_FORMATS[state.resultFormatId].defaultColumns];updateResults();} if(e.target.matches('.result-column-toggle')){const id=e.target.dataset.columnId;if(id==='label'){e.target.checked=true;return;}const selected=new Set(state.resultColumnSelection);e.target.checked?selected.add(id):selected.delete(id);state.resultColumnSelection=RESULT_COLUMN_DEFINITIONS.map(column=>column.id).filter(columnId=>selected.has(columnId)||columnId==='label');updateResults();} });
$('correctionPreflightDialog').addEventListener('cancel',(e)=>{e.preventDefault();closeCorrectionPreflight();});
document.addEventListener('toggle',(e)=>{ if(e.target.matches?.('.subarea-card')&&e.target.open){state.activeSubarea=e.target.dataset.subarea;updateStartingLevelVisuals({scroll:true,reason:'open'});} },true);
document.addEventListener('submit',async(e)=>{ if(e.target.id!=='loginForm') return; e.preventDefault(); $('loginMessage').textContent=''; try{ await signInNeurointegra({email:$('loginEmail').value.trim(),password:$('loginPassword').value,remember:$('rememberSession').checked}); }catch(err){ $('loginMessage').textContent=friendlyAuthError(err); } });
window.addEventListener('beforeunload',(event)=>{ if(state.saveCoordinator?.hasPending()){ event.preventDefault(); event.returnValue=''; } });
// Best effort only: browsers do not promise to await asynchronous Firestore writes here.
window.addEventListener('pagehide',()=>{ void flushSave(); });
document.addEventListener('visibilitychange',()=>{ if(document.visibilityState==='hidden') void flushSave(); });
init();
