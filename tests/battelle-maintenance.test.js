import test from 'node:test';
import assert from 'node:assert/strict';
import { MAINTENANCE_MODE, activeSessions, createMaintenanceRepository, maintenanceControlAllowed, normalizeMaintenance, normalizeSession } from '../src/battelle-maintenance.js';

const timestamp=iso=>({toDate:()=>new Date(iso)});

test('la ausencia de configuración mantiene la aplicación abierta',()=>{
  assert.equal(normalizeMaintenance(null).mode,MAINTENANCE_MODE.OPEN);
  assert.equal(normalizeMaintenance({mode:'valor-invalido'}).mode,MAINTENANCE_MODE.OPEN);
});

test('solo cuentan como activas las sesiones con señal reciente',()=>{
  const now=Date.parse('2026-10-16T10:00:00.000Z');
  const recent=normalizeSession('recent',{id:'recent',uid:'shared',view:'assessment',lastSeen:timestamp('2026-10-16T09:59:20.000Z')});
  const stale=normalizeSession('stale',{id:'stale',uid:'shared',view:'assessment',lastSeen:timestamp('2026-10-16T09:57:00.000Z')});
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
  await repository.setMode(MAINTENANCE_MODE.OPEN,'');
  assert.deepEqual(writes.map(write=>write.path),Array(3).fill('organizations/neurointegra/system/maintenance'));
  assert.equal(writes.some(write=>write.path.includes('/assessments')),false);
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
