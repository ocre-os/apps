# PRISMA — Asignación controlada del piloto v1.5

**Estado (2026-11-03):** plan de distribución preparado; **0/6 corridas reales**, 0 dictámenes ciegos. No cambia la app v0.5 ni OCRE-OS Core.

## Por qué existe esta fase

La instrumentación v1.4 comprobaba integridad de los expedientes y separación entre investigadores y revisores, pero no preparaba una distribución equitativa por persona. No confundir un plan reproducible con un experimento realizado.

## Diseño de asignación

- Dos operadores con alias `operador_1`, `operador_2` y un revisor externo distinto.
- Tres problemas, exactamente dos corridas por problema: una `prisma` y otra `ia`, ejecutadas **por operadores diferentes**. Cada persona ve cada expediente sólo una vez.
- Por ser tres casos, se distribuyen 2/1 las condiciones entre los operadores (no es un ensayo cruzado completo ni elimina los efectos de persona).
- La semilla de 256 bits se conserva **sólo en coordinación** para reconstruir la asignación. Cada corrida usa ID ciego no informativo derivado de la semilla.
- Los ZIP individuales del operador contienen únicamente sus tres enunciados, instrucciones y método asignado; nunca los desenlaces ni el mapa del otro operador.
- La plantilla de revisión contiene únicamente el ID ciego y el caso, no método/operador. El revisor podrá recibir desenlaces **después** de congelar las seis salidas y sin conocer la asignación.
- El orden de trabajo se especifica como `orden_previsto`; el tiempo y orden **ejecutados** deben medirse, no inferirse.

## Validación local de la herramienta de distribución

- Generador local `preparar_asignaciones.py` más `test_preparar_asignaciones.py`: **12/12 pruebas**.
- Suite combinada (evaluador, manifiestos, fuentes, asignación): **50/50** pruebas locales.
- Verificación contra kit v1.4: **6/6** documentos fuente correctos por SHA-256 y ZIP de roles separados.
- Se eliminó variación de bytes de ZIP causada por las marcas de tiempo internas; con semilla y enunciados idénticos se producen ZIP idénticos.
- Manifiesto generado: 3 SHA-256 de enunciado y dos SHA-256 de ZIP; `runs_planned=6`, `runs_completed=0`, `human_blinding_verified=false`, `field_effectiveness_proven=false`.
- El código y los paquetes v1.5 están **en el artefacto local de coordinación de la conversación**, todavía no versionados bajo esta PR. El software del evaluador v1.4 sí está versionado en `docs/tools/prisma-pilot`.

## Qué NO certifica

El algoritmo no garantiza que una persona desconozca el desenlace público, que no busque información adicional o que un revisor no reconozca el método por la redacción. La anonimización de salidas deberá eliminar identificadores de método sin alterar afirmaciones y registrar transformaciones. Con 3 casos cualquier comparación es exploratoria, sin inferir superioridad estadística. No incorporar al repositorio público archivos de investigación que puedan identificar a personas o clientes.

## Compuertas antes de correr

1. Aceptar o sustituir M02 por evidencia con resolución suficientemente verificable y confirmar elegibilidad de S01 y A01.
2. Reclutar y comprobar desconocimiento previo de desenlaces en dos operadores y un revisor diferente.
3. Confirmar mismo material para cada par, versión del sistema, restricciones y reglas de uso de fuentes.
4. Entregar paquetes individuales y registrar consentimiento; mantener mapa reservado.
5. Sólo tras las seis respuestas originales congeladas y evaluación ciega, generar reporte cuantitativo con advertencias y errores críticos.

**Despliegue:** documentación sólo en la rama de PR #75; no fusionar ni publicar automáticamente.
