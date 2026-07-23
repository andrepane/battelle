import { getFirebaseServices } from './firebase-app.js';
export const AUTH_ERROR = Object.freeze({ ANONYMOUS:'auth/anonymous-user', UNAUTHORIZED:'auth/unauthorized-user' });
export async function signInNeurointegra({email,password,remember}){
  const {auth, db, modules}=await getFirebaseServices();
  await modules.auth.setPersistence(auth, remember ? modules.auth.browserLocalPersistence : modules.auth.browserSessionPersistence);
  const credential=await modules.auth.signInWithEmailAndPassword(auth,email,password);
  return ensureAuthorized(credential.user,{db,modules});
}
export async function ensureAuthorized(user, servicesPromise){
  if(!user) return null;
  if(user.isAnonymous){ const err=new Error('La autenticación anónima no está permitida.'); err.code=AUTH_ERROR.ANONYMOUS; throw err; }
  const {db,modules}=servicesPromise || await getFirebaseServices();
  const ref=modules.firestore.doc(db,'authorizedUsers',user.uid);
  const snap=await modules.firestore.getDoc(ref);
  const data=snap.exists()?snap.data():null;
  if(!data?.active || data.organizationId!=='neurointegra') { const err=new Error('Cuenta no autorizada para Neurointegra.'); err.code=AUTH_ERROR.UNAUTHORIZED; throw err; }
  return {uid:user.uid,email:user.email||'',organizationId:'neurointegra',role:data.role||'shared'};
}
export async function observeAuthState(callback){
  const {auth}=await getFirebaseServices();
  const {auth:authMod}= (await getFirebaseServices()).modules;
  return authMod.onAuthStateChanged(auth, callback);
}
export async function signOutNeurointegra(){ const {auth,modules}=await getFirebaseServices(); return modules.auth.signOut(auth); }
export function friendlyAuthError(error){
  if(['auth/invalid-credential','auth/wrong-password','auth/user-not-found','auth/invalid-email'].includes(error?.code)) return 'Correo o contraseña incorrectos.';
  if(error?.code==='auth/too-many-requests') return 'Demasiados intentos. Espera unos minutos antes de reintentar.';
  if(error?.code===AUTH_ERROR.UNAUTHORIZED) return 'Cuenta no autorizada para Neurointegra.';
  if(error?.code===AUTH_ERROR.ANONYMOUS) return 'La autenticación anónima no está permitida.';
  if(!navigator.onLine || error?.code==='unavailable') return 'No hay conexión. Revisa la red e inténtalo de nuevo.';
  return 'No se pudo iniciar sesión. Revisa los datos e inténtalo de nuevo.';
}
