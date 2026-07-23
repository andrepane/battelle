export const FIREBASE_SDK_VERSION = '10.12.5';
export const firebaseConfig = Object.freeze({
  apiKey: 'AIzaSyDbRieNqAgIRR5Gl0t0mVisSC7b0-PLDNY',
  authDomain: 'battelle-edd13.firebaseapp.com',
  projectId: 'battelle-edd13',
  storageBucket: 'battelle-edd13.firebasestorage.app',
  messagingSenderId: '940123123026',
  appId: '1:940123123026:web:06c57ba31c6815c4f35e8b'
});
const CDN = `https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}`;
let firebaseModulesPromise;
export async function loadFirebaseModules(){
  if(!firebaseModulesPromise){
    firebaseModulesPromise = Promise.all([
      import(`${CDN}/firebase-app.js`),
      import(`${CDN}/firebase-auth.js`),
      import(`${CDN}/firebase-firestore.js`)
    ]).then(([app, auth, firestore])=>({app, auth, firestore}));
  }
  return firebaseModulesPromise;
}
let firebaseServicesPromise;
export async function getFirebaseServices(){
  if(!firebaseServicesPromise){
    firebaseServicesPromise = loadFirebaseModules().then(({app, auth, firestore})=>{
      const instance = app.getApps().length ? app.getApp() : app.initializeApp(firebaseConfig);
      return { app: instance, auth: auth.getAuth(instance), db: firestore.getFirestore(instance), modules:{app, auth, firestore} };
    });
  }
  return firebaseServicesPromise;
}
