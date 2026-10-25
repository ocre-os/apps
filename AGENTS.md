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
