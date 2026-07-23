# Firebase Neurointegra para Battelle

## Arquitectura
La aplicación web estática carga el SDK modular oficial de Firebase desde `www.gstatic.com` con versión fijada `10.12.5`. La inicialización está en `src/firebase-app.js`, la autenticación en `src/battelle-auth.js`, el repositorio compartido en `src/battelle-firestore-repository.js` y la importación desde `localStorage` en `src/battelle-local-import.js`.

## Autenticación y autorización
Authentication usa Email/Password. No hay registro, recuperación de contraseña ni autenticación anónima desde la aplicación. Las reglas rechazan usuarios anónimos y exigen un documento manual `authorizedUsers/{uid}` con:

```json
{
  "active": true,
  "organizationId": "neurointegra",
  "role": "shared"
}
```

Para crearlo: abre Firebase Console, entra en Authentication, copia el UID del usuario compartido y crea en Firestore el documento `authorizedUsers/{uid}` con esos campos. El cliente solo puede leer su propio documento de autorización y no puede crear ni modificar `authorizedUsers`.

Añade `battelle.vercel.app` en Firebase Console > Authentication > Settings > Authorized domains.

No compartas correo ni contraseña en GitHub, código, tests, issues o documentación. La configuración web de Firebase es pública; los datos quedan protegidos por Authentication, documentos `authorizedUsers` y reglas Firestore.

Limitación actual: al usar una cuenta compartida, `createdBy` y `updatedBy` identifican el UID compartido, no qué trabajador concreto realizó cada cambio.

## Ruta y esquema persistido
Colección principal: `organizations/neurointegra/assessments/{assessmentId}`.

Cada documento conserva el esquema funcional local `battelleAssessmentsV3`: `id`, `schemaVersion`, `name`, `birthDate`, `assessmentDate`, `manualAgeOverride`, `ageMonths`, `observedResponses`, `observations`, `workflowStatus`, `correctionMetadata`, `progress`, `createdAt`, `updatedAt` y `revision`. Añade `organizationId: "neurointegra"`, `createdBy` y `updatedBy`.

No se persisten DOM, funciones, resultados derivados completos, contraseñas, tokens, configuración privada ni contenido normativo duplicado.

## Revisiones y transacciones
`saveAssessment(record, expectedRevision)` y `deleteAssessment(id, expectedRevision)` usan transacciones. La transacción lee el documento remoto, compara `expectedRevision`, rechaza conflictos si cambió, incrementa `revision`, conserva `createdAt` y actualiza `updatedAt` con timestamp de servidor en Firestore. La interfaz solo muestra guardado cuando Firestore confirma la operación.

## Tiempo real y offline
El panel usa `onSnapshot` para ver creaciones, modificaciones y eliminaciones hechas en otros dispositivos o pestañas. No se habilita persistencia IndexedDB; Firestore usa su caché en memoria predeterminada. Si falla la red o hay cambios pendientes, la UI muestra “Sin conexión / cambios pendientes” y no simula éxito.

Si cambia remotamente la evaluación abierta, la aplicación muestra conflicto y ofrece recargar la versión guardada o conservar temporalmente la edición local. No se mezclan respuestas clínicas automáticamente.

## Migración desde localStorage
`localStorage.battelleAssessmentsV3` tiene `{schemaVersion: 3, revision, records: {[id]: evaluación}}`. Tras iniciar sesión se detecta la colección local y se muestra “Hay X evaluaciones guardadas únicamente en este dispositivo”. La importación es manual con “Importar a Neurointegra”, valida cada registro, preserva IDs libres, omite duplicados idénticos, no sobrescribe IDs remotos conflictivos, informa importadas/omitidas/inválidas/conflictivas y marca completada solo tras confirmación remota. No borra automáticamente la copia local ni implementa sincronización bidireccional permanente.

## Despliegue de reglas e índices
No se han desplegado recursos desde este PR. Para desplegar manualmente desde un entorno autenticado:

```bash
firebase use battelle-edd13
firebase deploy --only firestore:rules,firestore:indexes
```

El índice incluido ordena evaluaciones por `updatedAt` descendente.
