# Inventario de diálogos y mensajes

La auditoría inicial encontró seis llamadas nativas en `script.js`: cinco confirmaciones (cierre de sesión con guardado fallido, nueva evaluación con referencia, mover a papelera, restaurar y dos confirmaciones consecutivas para eliminar definitivamente) y un aviso de referencia no disponible. No se encontraron solicitudes de datos mediante `prompt` ni wrappers adicionales.

Todos esos puntos usan ahora el sistema común de diálogos. Los éxitos breves de papelera y restauración usan la región común de notificaciones. Los estados clínicos, de guardado, de conflicto, corrección, comparación, formularios, portapapeles y descarga que ya eran persistentes y estaban situados junto a su acción permanecen así para conservar su contexto.

## Excepción nativa permitida

El listener `beforeunload` se conserva exclusivamente para impedir el cierre o la recarga real mientras existen escrituras pendientes. Ese aviso pertenece al navegador, no admite una interfaz personalizada fiable y es la única ventana nativa iniciada indirectamente por la aplicación. También quedan fuera de este sistema los permisos, autenticación, portapapeles, descargas y selectores provistos por el navegador.
