# Indicadores de agentes en OCRE OS Status

Fecha: 2026-10-05
Estado: diseño ampliado pendiente de revisión; interfaz y estados aprobados por el usuario.

## Resultado esperado

Dos indicadores, Claude y Codex, muestran si los agentes de la ThinkPad-X280 están trabajando, esperando instrucciones o disponibles. Se incluye Codex de escritorio y las sesiones CLI relevantes a OCRE. No se muestran porcentajes ni se interpreta CPU o bloqueo de implementación como actividad.

## Estados

- Trabajando: existe un turno o trabajo activo confirmado por una fuente de ejecución.
- En espera: hay una sesión observada y ociosa, o esperando respuesta/aprobación. Mostrar un motivo genérico cuando la fuente lo confirme.
- Disponible: una observación completa y reciente confirma que no hay sesiones ni trabajos activos del agente.
- Sin información: la fuente no es accesible, está obsoleta, contiene un estado desconocido o no permite determinar actividad.

Si hay varias sesiones: trabajo confirmado tiene prioridad; sin trabajo confirmado, una fuente incompleta impide afirmar disponibilidad; después prevalece espera sobre disponible. Los trabajos secundarios pendientes mantienen Trabajando aunque el turno principal haya terminado, cuando la fuente permita observarlos.

## Evidencia y fuentes

Claude mantiene un registro local de sesión con PID, identidad de proceso, estado y fecha de actualización. La sesión actual reportó idle durante la investigación. El adaptador debe validar identidad del proceso y la semántica de los estados antes de utilizarlos; un registro ausente no equivale a disponibilidad.

Codex dispone de estados de ejecución y espera en su App Server. Antes de conectarlo debe comprobarse acceso de solo lectura a la instancia de escritorio existente. Abrir una instancia independiente no demuestra el estado de los chats del usuario. Si ese acceso no está disponible se muestra Sin información para esa fuente y se documenta la limitación; no se inventan estados.

## Conexión propuesta

Un observador local, separado de los agentes, lee únicamente metadatos de estado y produce una muestra saneada cada 5 segundos. La app pública consulta un endpoint de lectura HTTPS cada 10 segundos. Una muestra de más de 30 segundos se presenta como Sin información.

Se propone validar primero un receptor de telemetría en Staging y conectar la app de status a él. El envío requiere autenticación del observador; ningún secreto se incluye en el navegador. La selección Core/Staging no cambia el estado de los agentes, porque ambos indicadores representan la misma laptop.

El endpoint y sus credenciales se definirán en el plan después de revisar las capacidades de infraestructura existentes. No se desplegará en Core/producción como parte de esta validación.

## Datos publicados

Solo agente, estado, motivo genérico permitido y fecha de observación. No se publican prompts, respuestas, nombres de chats, comandos, rutas, PIDs, sockets ni credenciales. El observador no inicia tareas, cierra sesiones ni altera el selector de implementador.

El monitor será un proceso local identificado expresamente como monitor. Claude permanece en su terminal visible. No se configura autoinicio sin incluirlo expresamente en el alcance posterior.

## Verificación

Comprobar sesión abierta sin tarea, turno activo, espera de aprobación, trabajo secundario activo, cierre de sesión, múltiples sesiones, fuente ausente, desconexión y muestra caducada. Verificar transición en pantalla móvil y escritorio, accesibilidad sin depender del color y exclusión de datos privados en la respuesta pública.

No modificar el cambio local preexistente de os-status/matrix.js. No implementar concurrentemente en core mientras Claude conserve la sesión de implementador.

## Referencia

https://learn.chatgpt.com/docs/app-server — estados de ejecución y notificaciones de cambio de estado de Codex.