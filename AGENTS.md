# OCRE-OS Apps — instrucciones para agentes

## Alcance y precedencia
Estas instrucciones rigen el trabajo automatizado en este repositorio. Core es la fuente de verdad de contratos, permisos, autenticación, cuotas y acciones. No inventar endpoints ni estados. Mantener la experiencia móvil Android compacta, accesible y coherente con el modo Matrix.

## Ejecución y seguridad
- Inspeccionar contratos, implementación, ramas y pruebas existentes antes de modificar.
- Trabajar en rama aislada; preservar modificaciones locales y trabajo exclusivo. No fusionar ni desplegar sin las comprobaciones y autorizaciones correspondientes.
- Preferir correcciones hacia adelante (roll-forward); conservar el historial Git y evidencias de auditoría.
- Consolidar documentación duplicada, eliminar ramas/worktrees redundantes solo tras verificar que no contienen trabajo exclusivo y conservar una sola implementación vigente.
- Distinguir estados desconocidos, caducados, no configurados, degradados, fallidos y operativos. No inferir autenticación, cuota o disponibilidad de señales indirectas.

## Informe operativo al terminar cada intervención
1. **Resultado:** solo hechos ejecutados y verificados, con pruebas, SHA y PR cuando correspondan.
2. **Para completar:** número de pasos restantes y criterio verificable de cada uno.
3. **Necesito de ti:** solo decisiones, accesos o autorizaciones indispensables; si no hay, indicarlo brevemente.
4. **Siguiente ejecución:** propuesta concreta y agrupada que el usuario pueda aprobar respondiendo **«sí»**.

Evitar listas de acciones no realizadas y confirmaciones repetitivas. Informar bloqueos o limitaciones solo cuando afecten el siguiente paso, la seguridad o la veracidad del estado. No declarar completada una integración por aprobar pruebas parciales. Avanzar autónomamente dentro del alcance autorizado, agrupando preguntas y decisiones.

## Protocolo de continuidad: un «sí», un hito verificable
- Mantener un plan corto de hitos con entregable, criterios de aceptación, dependencias y estado; conservarlo en el PR, tarea o documento versionado, no solo en la conversación.
- Cada «sí» autoriza ejecutar de extremo a extremo **el siguiente hito ya definido**, dentro de los permisos vigentes. Incluye inspección indispensable, cambios, pruebas, evidencias y PR cuando corresponda. No detenerse en análisis o propuesta si se puede completar un entregable seguro.
- Subtareas técnicas y correcciones necesarias forman parte del mismo hito: no pedir un «sí» por cada comando, archivo, prueba o decisión rutinaria.
- Si un hito no puede cerrarse por un bloqueo real, reportar **hito parcial/bloqueado**, no descontarlo del total; completar trabajo independiente verificable y describir el criterio exacto pendiente.
- Contar como **hito completado** únicamente lo que cumpla su criterio de cierre; distinguir explícitamente «implementado y probado», «PR listo para revisión», «integrado» y «desplegado y verificado». Las pruebas automatizadas no sustituyen revisión visual o independiente exigida.
- Antes de cerrar, consultar el estado real de GitHub/CI/contratos para evitar reportar información obsoleta. Adjuntar SHA, resultados de pruebas y enlaces verificables.
- Al terminar, informar cuántos hitos quedan y cuál se ejecutará con el próximo «sí». No reiniciar el plan ni volver a solicitar aprobaciones ya concedidas.
- Una autorización para un hito no anula protecciones, revisiones independientes, límites de acceso ni aprobaciones expresas para operaciones destructivas, despliegues o cambios sensibles.
- Si el usuario pide hacer persistente este protocolo, mantener esta fuente versionada y facilitar también su incorporación a las instrucciones de proyecto de ChatGPT, que no pueden editarse desde el repositorio.
