# PRISMA v0.5 — Auditoría del piloto v1.1 (2026-11-03)

**Estado:** instrumentación corregida; **sin corridas comparativas reales**. Esta nota amplía el protocolo de la PR #75; no cambia la aplicación publicada ni OCRE-OS Core.

## Verificación del estado

- PR #75: abierta, sin fusionar; sólo documentación.
- Issue #76: abierto; un expediente de software S01 procede de una corrección pública documentada en PR #52.
- M01 (maquinaria): paquete anonimizado a partir de un relato histórico; **no habilitado para evaluación** hasta autorización expresa de uso y validación de la documentación técnica. La recuperación observada tras varias intervenciones no permite aislar una causa.
- A01 (administración): **no existe todavía un caso real resuelto y documentado**. El ejemplo de facturas vencidas del benchmark era sintético; no debe contarse.
- **Corridas de campo: 0/6. Dictámenes ciegos: 0/6.**

## Problemas detectados en el kit v1 y correcciones locales v1.1

1. El ZIP anterior incluía enunciados y desenlaces; riesgo de que la persona investigadora conozca la respuesta.
   - Corrección: distribuir paquetes separados `investigador` (solo enunciados) y `revisor` (solo desenlaces) con manifiestos SHA-256. La separación es procedimental, no control criptográfico.
2. El evaluador inicial permitía registrar en dos métodos el mismo orden y no comprobaba que los SHA-256 de entrada coincidieran.
   - Corrección: v1.1 valida pares, órdenes complementarios, entradas idénticas declaradas, salidas congeladas distintas, IDs únicos, contadores, tiempos finitos positivos y revisión diferente del operador.
3. No se distinguía formalmente si el operador conocía el desenlace o si la revisión fue ciega.
   - Corrección: metadatos explícitos `operator_prior_knowledge` y `reviewer_blinded`; el resumen señala estas limitaciones. El código solo comprueba lo declarado, no su veracidad.
4. Se corrige la ambigüedad de `0/0`: la tasa de trazabilidad o de capacidad discriminante se reporta `null`, no cero.

## Pruebas de instrumentación

- `python3 -m unittest -v test_evaluar.py`: **17/17 tests aprobados** en el kit local v1.1, sin archivos de clientes ni red.
- `python3 evaluar.py PLANTILLA-corridas-v1.1.csv`: `cases_seen: 0`, `paired_cases: 0`, `can_claim_superiority: false`.
- Las filas de pruebas automáticas son **ficticias** y no se cuentan como corridas del piloto.
- El código local de la instrumentación v1.1 y los ZIP de distribución se entregaron como artefactos de conversación, no forman parte de esta PR. **No declarar la PR reproducible de extremo a extremo hasta versionarlos también**.

## Compuertas para la fase de campo

1. Un problema administrativo real con desenlace verificable; autorización y anonimización de M01.
2. Verificación del desconocimiento previo del desenlace por la persona operadora, especialmente S01 por ser fuente pública.
3. Seis salidas congeladas, tiempos completos y dos métodos alimentados con la misma información.
4. Revisión independiente ciega, referencias por afirmación y registro de errores críticos.
5. Informe descriptivo sobre datos auténticos, sin declarar superioridad con una muestra de tres casos.

**Producto:** PRISMA v0.5 no se modifica ni despliega; evitar nuevas funciones hasta demostrar que aportan valor con datos de campo.
