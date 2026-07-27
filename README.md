# Battelle – Neurointegra

Aplicación web para administrar, guardar y corregir evaluaciones del Inventario de
Desarrollo Battelle. Conserva las respuestas clínicas, aplica basal/techo y consulta
los baremos versionados del proyecto. No sustituye el criterio profesional.

## Estructura

- `index.html`, `styles.css` y `script.js`: interfaz y orquestación.
- `src/`: datos, puntuación, corrección, flujo, autenticación y repositorios.
- `data/`: 341 ítems, modelo de escalas y datos normativos versionados.
- `scripts/` y `tests/`: extracción/validación Python y pruebas JavaScript.
- `firestore.rules`, `firestore.indexes.json` y `firebase.json`: Firebase.

## Instalación y pruebas

Requiere Node.js 20 o posterior, npm, Python 3.11 o posterior y Java para Firebase
Emulator. La instalación reproducible y las comprobaciones principales son:

```sh
npm ci
npm test
python -m unittest tests/test_baremos_battelle.py
python scripts/validar_items.py
python scripts/validar_modelo_escalas.py
python scripts/validar_baremos_battelle.py
python scripts/validar_fuentes_excel.py
npm run test:firestore-rules
```

La última orden inicia Firestore Emulator y ejecuta pruebas reales contra las reglas;
no es equivalente a una inspección estática.

## Firebase y despliegue

Configure un proyecto Firebase con Authentication (sin acceso anónimo) y Firestore.
Cada usuario permitido necesita `authorizedUsers/{uid}` con `active: true` y
`organizationId: "neurointegra"`. Configure en el entorno los valores públicos del
SDK descritos en `docs/firebase-neurointegra.md`; después valide en emulador y use
`firebase deploy --only firestore:rules,firestore:indexes,hosting` con el proyecto
correcto seleccionado. No se habilita persistencia IndexedDB de Firestore.

## Sincronización y conflictos

Cada evaluación es un documento independiente en
`organizations/neurointegra/assessments/{id}`. Su cola de autoguardado es exclusiva,
serial y conserva la revisión esperada de ese documento. Firestore confirma cada
escritura antes de mostrarla como guardada. Dos dispositivos pueden editar documentos
distintos simultáneamente; solo hay conflicto si intentan avanzar la misma revisión
del mismo documento. Las revisiones aumentan exactamente en uno. Cambiar de pantalla
espera el guardado; `pagehide` y ocultar la pestaña solo realizan un mejor intento.
Una eliminación remota cancela la cola local para impedir que el documento reaparezca.

## Seguridad

Los datos clínicos son sensibles. **Nunca suba historias clínicas identificables,
credenciales, claves privadas, archivos `.env` ni cuentas reales al repositorio.**
Revise el diff y las reglas antes de cada despliegue.
