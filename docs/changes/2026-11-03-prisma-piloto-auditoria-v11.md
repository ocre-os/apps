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

## Actualización de reproducibilidad — 2026-11-03 (v1.2)

- Instrumentos incorporados a esta misma PR bajo `docs/tools/prisma-pilot/`: `evaluar.py`, `test_evaluar.py`, ambas plantillas CSV y `README.md`.
- Se comprobó igualdad textual entre los dos archivos Python versionados y los archivos del kit local v1.1. Ejecutadas localmente: **17/17 pruebas unitarias**. La plantilla vacía reporta **0 casos, 0 pares y ninguna afirmación de superioridad**.
- Los archivos están en `docs/**`, excluidos del flujo FTP de Apps; la interfaz pública v0.5 no cambia.
- Se identificó un candidato **A01 externo, público y resuelto** en conciliación de anticipos/facturas; problema y desenlace se separaron en los paquetes locales v1.2. Sus fuentes quedan reservadas al coordinador/revisor para preservar cegamiento. Sigue **pendiente de admisibilidad** por mezclar operación administrativa y defecto de software.
- El paquete `M01` sigue sin autorización ni causalidad corroborada; `S01` requiere verificar desconocimiento previo; **0/6 corridas reales**.
- La PR sigue sin fusionar: requiere revisión independiente del protocolo y privacidad antes de integrarse.

## Actualización de instrumentación v1.4 — 2026-11-03

- Se incorporaron a esta PR los archivos `docs/tools/prisma-pilot/verificar_fuentes.py`, `test_verificar_fuentes.py` y `README-OPERATIVO.md`, bajo `docs/**` (excluido del despliegue FTP).
- El nuevo validador comprueba `prisma-pilot-source-files-v1`: SHA-256 de los **seis documentos**, correspondencia de casos S01/M02/A01, rutas seguras y separación entre ZIP de investigador y ZIP de revisor. No verifica ausencia de conocimiento previo ni cegamiento real.
- Los archivos de pruebas añaden **14 casos** a los 24 existentes: **38/38** aprobados tanto en el contenedor de trabajo como en la ThinkPad (WSL), ejecutando una copia aislada de la rama de GitHub con `python3 -m unittest discover -s docs/tools/prisma-pilot -p 'test_*.py' -v`.
- Hashes SHA-256 de archivos nuevos coincidentes entre ZIP local y GitHub: `verificar_fuentes.py` `67363311c9f7297366adc0f8b1b5fae550863655d34afd04c0aad3857c514edf`; `test_verificar_fuentes.py` `9f71a0bcefddbcbbd3600a623a026fdfbeb098e8a8f7d016e99e4586a3aa4c07`.
- Se distribuye kit **v1.4** en tres ZIP separados. El paquete completo permanece sólo bajo custodia del coordinador y **no se sube a GitHub**, para no filtrar desenlaces de casos.
- Dos manifiestos distintos: `prisma-pilot-source-files-v1` para enunciados/desenlaces y `prisma-pilot-artifacts-v1` para la integridad de entradas/salidas de cada corrida. El evaluador de métricas por sí solo **no** verifica contenido físico.
- Estado empírico: **0/6 corridas reales, 0 revisiones ciegas; ningún resultado comparativo**. Los 3 expedientes sólo son candidatos hasta comprobar elegibilidad y reclutamiento de operadores ajenos al desenlace.
- La PR #75 permanece abierta y **no debe fusionarse sin revisión de contenido y privacidad**. PRISMA v0.5 y OCRE-OS Core siguen sin modificaciones.
