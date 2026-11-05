# PRISMA — protocolo de usabilidad v1.0 (v0.6.2)

**Estado: listo para reclutamiento; 0/5 participantes reales.** Independiente del piloto PRISMA vs ChatGPT (#76). Seguimiento: issue #85.

## Objetivo y límites

Observar si una persona puede registrar un problema con una fuente, recuperarlo y restaurarlo desde un respaldo usando PRISMA sin IA, y comparar exploratoriamente la captura con su método habitual. Usar únicamente escenarios **ficticios**. No afirmar superioridad ni diagnóstico correcto con cinco personas.

**Condiciones:** 5 participantes, ≥2 técnicos; el mismo participante prueba ambas condiciones en escenarios diferentes A/B y orden alternado. Consultar `asignaciones.csv`. Los escenarios comparten estructura pero **su dificultad equivalente no está demostrada**. No introducir datos de clientes ni contenido confidencial: PRISMA usa localStorage no cifrado, sin sincronización, y el hosting agrega telemetría.

## Tareas y límites de tiempo

1. **Captura A/B:** máximo 8 minutos por escenario y condición. Tiempo desde lectura de tarjeta hasta confirmar que problema, observación y fuente quedaron registrados (si usa PRISMA, comprobar persistencia). Próximo paso/hipótesis es opcional, no requisito.
2. **Recuperación PRISMA:** encontrar el análisis, explicar lo que se sabe y una incertidumbre; máximo 5 minutos.
3. **Respaldo PRISMA:** descargar JSON y restaurarlo en perfil vacío, comprobando presencia del mismo análisis; máximo 8 minutos.
4. **Retorno diferido:** 7 días después (±1), recuperar análisis y explicar límite/conclusión provisional; máximo 5 minutos, distinguir acceso por navegador o respaldo.

Moderador no enseña botones; registra todas las ayudas, errores de guardado y salidas. Si hay pérdida silenciosa, respaldo irrecuperable o error crítico de interpretación, detener recomendación de piloto ampliado.

## Instrumentación

- `participante.md`: instrucciones neutrales que pueden enviarse a la persona.
- `moderador.md`: guion y criterios operativos.
- `escenarios.md`: tarjetas A/B ficticias sin desenlace.
- `asignaciones.csv`: diez turnos predefinidos.
- `capturas.csv`, `tareas.csv`, `participantes.csv`: **solo encabezados**, sin resultados.
- El evaluador Python y sus 16 pruebas unitarias están en el kit de coordinación preparado en esta conversación; **no forman parte todavía de este PR documental**. El evaluador calcula métricas descriptivas y rechaza datos inconsistentes. No presentar sus tests con escenarios simulados como resultados de personas.

La publicación de estos documentos no modifica la aplicación ni contacta participantes. Solo publicar resultados agregados y anonimización verificada. Evitar compartir respuestas individuales con datos potencialmente identificables.
