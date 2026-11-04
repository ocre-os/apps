# PRISMA v0.6 — Captura rápida y vista enfocada

**Estado:** implementación funcional propuesta en rama aislada; no depende de IA, servicios externos ni OCRE-OS Core.

## Problema observado
La versión v0.5 exige crear un análisis, añadir una observación e introducir hipótesis mediante formularios sucesivos. La pantalla inicial presenta varias secciones técnicas que pueden desalentar a quien solo desea registrar un problema y volver a consultarlo.

## Solución
- **Captura rápida:** un único campo obligatorio (descripción de la situación); nombre, área, observación, procedencia e hipótesis son opcionales. Si se documenta una observación, su procedencia pasa a ser obligatoria. No se inventan fuentes ni causas.
- **Vista enfocada:** observa → explica → comprueba → concluye. Muestra pocas entradas recientes y acceso a la siguiente comprobación elegible, con las mismas advertencias de riesgo.
- **Vista completa:** conserva íntegramente las funciones de hipótesis, matrices, comprobaciones, síntesis, versiones y patrones. También recupera el formulario avanzado de nuevo análisis.
- **Captura desde móvil:** botón «Nuevo análisis» visible sin abrir el menú lateral.

## Compatibilidad
El modelo y clave permanecen **v0.5**: `ocre_prisma_v05` y `version:5`. No se efectúan migraciones ni operaciones destructivas de los datos. La vista enfocada es solo una presentación del mismo estado. Los respaldos exportados siguen siendo v0.5 y son importables en la versión previa.

## Controles
- La observación requiere su fuente; la hipótesis es identificada como provisional.
- Sin generación de respuestas, IA, diagnóstico automático, autorización de maniobras, cambios en Core o endpoints nuevos.
- Los datos permanecen sin cifrar en el almacenamiento local del navegador: no usar información confidencial.

## Verificación local
- `node --check` del código: correcto.
- `node --test` del motor: **9/9**.
- Recorrido Chromium v0.6: captura mínima, requisito de procedencia, XSS, persistencia v0.5, vista avanzada, exportación JSON, Android 390 px sin desplazamiento horizontal.
- Regresión Chromium v0.5 adaptada a «Vista completa»: historial, matrices, importaciones, patrones, síntesis y móvil.

## Pendiente de evaluación de producto
El menor número de campos es una mejora de interfaz, **no una demostración de menor tiempo real**. Medir con personas el tiempo desde abrir la aplicación hasta registrar una observación con su procedencia y la proporción de análisis retomados una semana después, comparando contra una bitácora corriente. No afirmar eficacia o valor comercial sin datos de uso.

## Publicación
La rama se propone por PR. No mezclar con PR #75 del piloto metodológico; desplegar únicamente después de revisión y validación de compatibilidad.