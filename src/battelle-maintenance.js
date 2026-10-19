import { getFirebaseServices } from './firebase-app.js';

export const MAINTENANCE_MODE=Object.freeze({OPEN:'open',DRAINING:'draining',ACTIVE:'maintenance'});
export const MAINTENANCE_PATH='organizations/neurointegra/system/maintenance';
export const SESSIONS_PATH='organizations/neurointegra/sessions';
export const SESSION_STALE_MS=90_000;
export const PRODUCTION_HOSTS=Object.freeze(['battelle.vercel.app']);
export const REFRESH_ACK_PREFIX='battelleMaintenanceRefresh:';

function timestampToIso(value){
  if(typeof value==='string')return value;
  if(value?.toDate)return value.toDate().toISOString();
  if(value instanceof Date)return value.toISOString();
  return null;
}

export function normalizeMaintenance(data){
  const mode=Object.values(MAINTENANCE_MODE).includes(data?.mode)?data.mode:MAINTENANCE_MODE.OPEN;
  return Object.freeze({mode,message:typeof data?.message==='string'?data.message:'',refreshId:typeof data?.refreshId==='string'&&data.refreshId?data.refreshId:null,updatedAt:timestampToIso(data?.updatedAt),updatedBy:typeof data?.updatedBy==='string'?data.updatedBy:null});
}

export function refreshAckKey(environmentId){return `${REFRESH_ACK_PREFIX}${previewEnvironmentId(environmentId)}`;}
export function refreshRequired(maintenance,{storage=globalThis.localStorage,environmentId='production'}={}){if(maintenance?.mode!==MAINTENANCE_MODE.OPEN||!maintenance?.refreshId)return false;try{return storage?.getItem(refreshAckKey(environmentId))!==maintenance.refreshId;}catch{return true;}}
export function acknowledgeRefresh(refreshId,{storage=globalThis.localStorage,environmentId='production'}={}){if(!refreshId)return false;try{storage?.setItem(refreshAckKey(environmentId),refreshId);return true;}catch{return false;}}

export function normalizeSession(id,data){
  if(!data||data.id!==id||typeof data.uid!=='string')return null;
  const lastSeen=timestampToIso(data.lastSeen);
  if(!lastSeen)return null;
  return Object.freeze({id,uid:data.uid,role:data.role==='admin'?'admin':'shared',email:typeof data.email==='string'?data.email:'',view:data.view==='assessment'?'assessment':'home',assessmentId:typeof data.assessmentId==='string'?data.assessmentId:null,therapistName:typeof data.therapistName==='string'?data.therapistName:null,pending:Boolean(data.pending),lastSeen});
}

export function activeSessions(sessions,now=Date.now(),staleMs=SESSION_STALE_MS){
  return (sessions??[]).filter(session=>{const seen=Date.parse(session?.lastSeen);return Number.isFinite(seen)&&now-seen<=staleMs;});
}

export function maintenanceControlAllowed(hostname){return PRODUCTION_HOSTS.includes(String(hostname??'').toLowerCase());}
export function previewEnvironmentId(hostname){return String(hostname??'preview').toLowerCase().replace(/[^a-z0-9.-]/g,'-').slice(0,120)||'preview';}

function sessionId(env=globalThis){
  return env.crypto?.randomUUID?.()??`session-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function createMaintenanceRepository({user,servicesPromise=getFirebaseServices(),env=globalThis}={}){
  if(!user?.uid)throw new Error('Se requiere usuario autenticado.');
  const ready=Promise.resolve(servicesPromise),id=sessionId(env),hostname=env.location?.hostname??'',isProduction=maintenanceControlAllowed(hostname),environmentId=previewEnvironmentId(hostname);
  const maintenanceRef=async()=>{const {db,modules}=await ready;const path=isProduction?['organizations','neurointegra','system','maintenance']:['organizations','neurointegra','previewMaintenance',environmentId];return {modules,ref:modules.firestore.doc(db,...path)};};
  const sessionRef=async()=>{const {db,modules}=await ready;const path=isProduction?['organizations','neurointegra','sessions',id]:['organizations','neurointegra','previewSessions',environmentId,'sessions',id];return {modules,ref:modules.firestore.doc(db,...path)};};
  const sessionsRef=async()=>{const {db,modules}=await ready;const path=isProduction?['organizations','neurointegra','sessions']:['organizations','neurointegra','previewSessions',environmentId,'sessions'];return {modules,ref:modules.firestore.collection(db,...path)};};
  return {
    sessionId:id,isProduction,environmentId,
    async subscribeMaintenance(callback){const {modules,ref}=await maintenanceRef();return modules.firestore.onSnapshot(ref,snap=>callback(normalizeMaintenance(snap.exists()?snap.data():null)),error=>callback(null,{error}));},
    async setMode(mode,message='',{requireRefresh=false}={}){if(user.role!=='admin'||!Object.values(MAINTENANCE_MODE).includes(mode))throw new Error('Operación administrativa no autorizada.');const {modules,ref}=await maintenanceRef(),refreshId=requireRefresh?`refresh-${Date.now()}-${sessionId(env)}`:null;await modules.firestore.setDoc(ref,{mode,message:String(message).slice(0,240),refreshId,updatedAt:modules.firestore.serverTimestamp(),updatedBy:user.uid});},
    async subscribeSessions(callback){if(user.role!=='admin')throw new Error('Operación administrativa no autorizada.');const {modules,ref}=await sessionsRef();return modules.firestore.onSnapshot(ref,snap=>callback(snap.docs.map(doc=>normalizeSession(doc.id,doc.data())).filter(Boolean)),error=>callback(null,{error}));},
    async writePresence(getState){
      const write=async()=>{const current=getState?.()??{};const {modules,ref}=await sessionRef();await modules.firestore.setDoc(ref,{id,uid:user.uid,role:user.role==='admin'?'admin':'shared',email:String(user.email??'').slice(0,160),view:current.view==='assessment'?'assessment':'home',assessmentId:current.assessmentId??null,therapistName:current.therapistName?String(current.therapistName).slice(0,100):null,pending:Boolean(current.pending),lastSeen:modules.firestore.serverTimestamp()});};
      const remove=async()=>{try{const {modules,ref}=await sessionRef();await modules.firestore.deleteDoc(ref);}catch{/* La caducidad elimina el efecto de una sesión que no pudo borrarse. */}};
      await write();
      const timer=env.setInterval(()=>{void write();},20_000);
      return {touch:write,stop:async()=>{env.clearInterval(timer);await remove();}};
    }
  };
}
