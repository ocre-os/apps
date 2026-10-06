# Indicadores de agentes — plan de implementación

> Para ejecución: aplicar superpowers:executing-plans tarea por tarea en esta sesión.

**Objetivo:** mostrar estados reales de Claude y Codex de la ThinkPad en OCRE OS Status.

**Arquitectura:** observador local de solo lectura, receptor autenticado en Staging y dos indicadores independientes de la selección Core/Staging. Las muestras incompletas o caducadas se muestran como Sin información.

**Tecnologías:** Python estándar para el observador, FastAPI en Staging, HTML/CSS/JavaScript y pruebas existentes de Apps.

**Diseño:** diseno-indicadores-agentes.md, junto a este documento.

## Restricciones

No usar CPU, presencia de procesos ni el bloqueo de ocre-agent como prueba de trabajo. Claude permanece visible. Publicar solo agente, estado, motivo genérico y fecha. No enviar texto de conversaciones, comandos, rutas, PIDs ni secretos. Refresco del monitor: 5 segundos; navegador: 10 segundos; caducidad: 30 segundos. No desplegar Core ni modificar producción. Proteger os-status/matrix.js y los cambios existentes de core. El monitor no inicia tareas ni altera agentes.

## 1. Observador local

Archivos nuevos en una rama aislada de Apps: tools/agent-monitor/collector.py, collector.test.py y README.md. Fuentes: registros de sesión de Claude y metadatos de ciclos de tarea de Codex. Los registros de Codex son un formato interno: el adaptador debe validar el esquema y rechazar entradas no reconocidas.

- [ ] Escribir pruebas de idle/busy de Claude, inicio/fin/interrupción de tarea de Codex, identidad de proceso, lectura incompleta, trabajo secundario pendiente y caída del agente.
- [ ] Ejecutarlas y confirmar el fallo antes de implementar.
- [ ] Implementar collect_snapshot(now) y adaptadores independientes. Trabajando requiere tarea confirmada; espera requiere sesión confirmada sin trabajo pendiente; disponible requiere observación completa sin sesiones; en otro caso, desconocido.
- [ ] No asumir que task_complete implica disponibilidad. Verificar sesión y trabajos secundarios; si no es posible verificarlos, devolver desconocido.
- [ ] Validar con la sesión visible de Claude y el chat actual de Codex; confirmar que el JSON de salida no contiene datos privados.

## 2. Receptor de Staging

En un worktree aislado del repositorio Core, crear backend/app/agent_status.py y backend/tests/test_agent_status.py. Registrar rutas en backend/app/main.py y configuración en backend/app/config.py según la estructura existente. Documentar en ops/agent/README.md.

- [ ] Pruebas: escritura sin autenticación rechazada, contrato inválido rechazado, orden temporal, muestra obsoleta, campos privados excluidos y lectura sin muestra.
- [ ] Implementar POST /health/agents para recibir una muestra limitada y GET /health/agents para lectura saneada. Añadir la ruta de proxy pública /api/agents junto a /api/status.
- [ ] Usar un secreto del monitor separado de las credenciales del usuario; configurarlo mediante el mecanismo existente de Staging. No ponerlo en código ni en Apps.
- [ ] Integrar el envío del observador con timeout y recuperación; si falla, no bloquear a los agentes.
- [ ] Validar primero localmente y después en Staging. El proceso del monitor debe identificarse claramente y no se añade autoinicio.

## 3. Interfaz de status

Archivos: os-status/agents.js y agents.test.js nuevos; cambios acotados en index.html, styles.css y app.js. No editar matrix.js.

- [ ] Pruebas de normalización, caducidad, fuente ausente, respuesta malformada, errores de red y resultados antiguos fuera de orden.
- [ ] Añadir Claude y Codex con nombre, estado escrito, color accesible y fecha. No mostrar porcentajes ni avances inventados.
- [ ] Consultar /api/agents de Staging por separado de los checks Core/Staging. Una avería del agente no cambia el estado operativo de la plataforma.
- [ ] Verificar escritorio, teléfono, lector de pantalla y pérdida de conexión.

## Revisión final

- [ ] Sesión abierta sin tarea muestra En espera; tarea activa muestra Trabajando; cierre confirmado muestra Disponible; pérdida de fuente muestra Sin información.
- [ ] Incluir una prueba donde acaba el turno pero sigue un trabajo secundario.
- [ ] Revisar formato privado de Codex, cierres inesperados, múltiples sesiones, reloj desajustado y muestras atrasadas.
- [ ] Ejecutar pruebas apropiadas de Apps y backend, verificar diff y presentar el resultado en Staging antes de publicar Apps.

## Límite conocido

Todavía no está demostrada la detección completa de esperas de aprobación ni trabajos secundarios en Codex de escritorio. Esa prueba es condición de aceptación del adaptador. Si la fuente no permite confirmarlo, la interfaz mostrará Sin información y no se presentará esa cobertura como completada.