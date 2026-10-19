import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { MAINTENANCE_MODE, acknowledgeRefresh, activeSessions, createMaintenanceRepository, maintenanceControlAllowed, normalizeMaintenance, normalizeSession, refreshRequired } from '../src/battelle-maintenance.js';

const timestamp=iso=>({toDate:()=>new Date(iso)});

test('la ausencia de configuración mantiene la aplicación abierta',()=>{
  assert.equal(normalizeMaintenance(null).mode,MAINTENANCE_MODE.OPEN);
  assert.equal(normalizeMaintenance({mode:'valor-invalido'}).mode,MAINTENANCE_MODE.OPEN);
});

test('cada dispositivo debe confirmar la actualización una vez',()=>{
  const values=new Map(),storage={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)},maintenance=normalizeMaintenance({mode:'open',refreshId:'release-2'});
  assert.equal(refreshRequired(maintenance,{storage,environmentId:'production'}),true);
  assert.equal(acknowledgeRefresh(maintenance.refreshId,{storage,environmentId:'production'}),true);
  assert.equal(refreshRequired(maintenance,{storage,environmentId:'production'}),false);
  assert.equal(refreshRequired(normalizeMaintenance({mode:'maintenance',refreshId:'release-3'}),{storage,environmentId:'production'}),false);
});

test('una pestaña anterior al cambio debe actualizar aunque otra ya confirmase',()=>{
  const values=new Map([['battelleMaintenanceRefresh:production','release-3']]),storage={getItem:key=>values.get(key)??null};
  const maintenance=normalizeMaintenance({mode:'open',refreshId:'release-3',updatedAt:timestamp('2026-10-19T15:00:00.000Z')});
  assert.equal(refreshRequired(maintenance,{storage,environmentId:'production',tabStartedAt:Date.parse('2026-10-19T14:59:00.000Z')}),true);
  assert.equal(refreshRequired(maintenance,{storage,environmentId:'production',tabStartedAt:Date.parse('2026-10-19T15:01:00.000Z')}),false);
});

test('solo cuentan como activas las sesiones con señal reciente',()=>{
  const now=Date.parse('2026-10-16T10:00:00.000Z');
  const recent=normalizeSession('recent',{id:'recent',uid:'shared',view:'assessment',lastSeen:timestamp('2026-10-16T09:59:20.000Z')});
  const stale=normalizeSession('stale',{id:'stale',uid:'shared',view:'assessment',lastSeen:timestamp('2026-10-16T09:54:00.000Z')});
  assert.deepEqual(activeSessions([recent,stale],now).map(session=>session.id),['recent']);
});

test('los controles reales solo se habilitan en el dominio de producción',()=>{
  assert.equal(maintenanceControlAllowed('battelle.vercel.app'),true);
  assert.equal(maintenanceControlAllowed('battelle-git-preview.vercel.app'),false);
  assert.equal(maintenanceControlAllowed('localhost'),false);
});

test('cambiar el mantenimiento escribe solo configuración y nunca evaluaciones',async()=>{
  const writes=[];
  const firestore={
    doc:(db,...segments)=>({path:segments.join('/')}),
    collection:(db,...segments)=>({path:segments.join('/')}),
    serverTimestamp:()=>({server:true}),
    setDoc:async(ref,payload)=>writes.push({path:ref.path,payload})
  };
  const env={location:{hostname:'battelle.vercel.app'},crypto:{randomUUID:()=> 'session-admin'},sessionStorage:{getItem:()=>null,setItem:()=>{}},setInterval:()=>1,clearInterval:()=>{}};
  const repository=createMaintenanceRepository({user:{uid:'admin-uid',email:'admin@example.test',role:'admin'},servicesPromise:{db:{},modules:{firestore}},env});
  await repository.setMode(MAINTENANCE_MODE.DRAINING,'Cerrando');
  await repository.setMode(MAINTENANCE_MODE.ACTIVE,'Mantenimiento');
  await repository.setMode(MAINTENANCE_MODE.OPEN,'',{requireRefresh:true});
  assert.deepEqual(writes.map(write=>write.path),Array(3).fill('organizations/neurointegra/system/maintenance'));
  assert.equal(writes.some(write=>write.path.includes('/assessments')),false);
  assert.equal(writes[0].payload.refreshId,null);
  assert.match(writes[2].payload.refreshId,/^refresh-/);
});

test('una cuenta compartida no puede cambiar el modo desde el repositorio',async()=>{
  const repository=createMaintenanceRepository({user:{uid:'shared-uid',role:'shared'},servicesPromise:{db:{},modules:{firestore:{}}},env:{crypto:{randomUUID:()=> 'shared-session'},sessionStorage:{getItem:()=>null,setItem:()=>{}}}});
  await assert.rejects(repository.setMode(MAINTENANCE_MODE.ACTIVE),/no autorizada/i);
});

test('una preview usa configuración aislada de producción',async()=>{
  const writes=[];
  const firestore={doc:(db,...segments)=>({path:segments.join('/')}),serverTimestamp:()=>({server:true}),setDoc:async(ref)=>writes.push(ref.path)};
  const env={location:{hostname:'battelle-pr-99.vercel.app'},crypto:{randomUUID:()=> 'preview-session'},sessionStorage:{getItem:()=>null,setItem:()=>{}}};
  const repository=createMaintenanceRepository({user:{uid:'admin-uid',role:'admin'},servicesPromise:{db:{},modules:{firestore}},env});
  await repository.setMode(MAINTENANCE_MODE.DRAINING,'Prueba');
  assert.equal(repository.isProduction,false);
  assert.deepEqual(writes,['organizations/neurointegra/previewMaintenance/battelle-pr-99.vercel.app']);
});

test('finalizar mantenimiento muestra una actualización bloqueante y recarga con versión única',()=>{
  const script=readFileSync(new URL('../script.js',import.meta.url),'utf8');
  assert.match(script,/La aplicación se ha actualizado/);
  assert.match(script,/Actualizar la web/);
  assert.match(script,/ariaModal:'true'/);
  assert.match(script,/requireRefresh:true/);
  assert.match(script,/_battelle_refresh/);
  assert.match(script,/location\.replace\(url\.href\)/);
  assert.match(script,/\.inert=blocked\|\|refreshPending/);
});
