# PRISMA v0.6.1 — Captura progresiva, incertidumbre y corroboración declarada

**Fecha:** 2026-11-03 (America/Cancun)  
**Estado:** implementada y validada localmente, en revisión dentro de PR #80; NO desplegada por este cambio.

## Por qué

La prueba retrospectiva de tres incidentes públicos reveló que una síntesis formalmente consistente puede contradecir la fuente citada sin que el motor lo detecte, que algunas comprobaciones con predicciones desconocidas son excluidas aun cuando separan otras hipótesis y que los formularios avanzados presentan demasiados campos simultáneos. Una comparación retrospectiva realizada por el propio asistente no es una validación ciega del producto.

## Decisiones implementadas

1. **Comprobación progresiva**: al preparar una comprobación, mostrar método, criterio, duración y riesgo; conservar predicciones, resultados posibles, costo y autor en secciones desplegables. Las matrices siguen siendo editables antes de que la comprobación se registre como realizada; las predicciones desconocidas nunca se rellenan automáticamente.
2. **Contraste parcial**: el motor ahora puede ordenar una comprobación con `status=parcial` si existe al menos un par de hipótesis distinguible pese a otros pares con predicción desconocida. Mostrar el número de pares no evaluables y priorizar menor incertidumbre en caso de empate. **Nunca sugerir automáticamente comprobaciones de riesgo declarado alto.**
3. **Síntesis documentada ≠ corroborada**: ausencia de advertencias significa que las referencias son formalmente coherentes, **no** que el contenido de las fuentes apoye la conclusión. Se muestra explícitamente «Documentada · fuentes vinculadas» y «Sin corroboración declarada»; el motor devuelve `semanticVerified:false` sin excepciones.
4. **Corroboración humana declarada**: el usuario puede añadir una anotación a una síntesis con responsable, método, referencia y alcance. Las revisiones se registran de forma aditiva en `syntheses[].reviews` y se incluyen en resumen/exportación. PRISMA no autentica a la persona, no comprueba independencia ni certifica la referencia; la interfaz indica «declarada · sin certificación».
5. **Compatibilidad**: conserva `ocre_prisma_v05`, `version:5`, IDs y síntesis preexistentes. `reviews` es un campo opcional normalizado a lista vacía; la aplicación sigue importando respaldos v0.1–v0.5. No hay cambios a Core ni a su terminología.

## Pruebas de la versión

- `node --test docs/tests/prisma-v061/test_engine.cjs`: **8/8** pruebas sobre el motor inline de `prisma/index.html`.
- `python docs/tests/prisma-v061/test_ui.py`: Chromium: flujo progresivo, predicciones desconocidas sin fabricación, revisión humana, conservación al recargar, móvil 390 px y cero errores JS.
- Además, sobre la distribución de desarrollo se ejecutaron **11/11** pruebas de motor y regresión histórica de formularios, síntesis, patrones, exportación, v0.1–v0.4 y presentación móvil.
- La implementación NO demuestra mejora de tiempo de captura ni exactitud diagnóstica; quedan pendientes ensayos con usuarios independientes.

## Límites y vigilancia

- Se permiten declaraciones humanas que pueden ser inexactas; el sistema no puede detectar una referencia engañosa sólo porque esté vinculada.
- No presentar corroboración declarada como verificación factual externa o certificación.
- El riesgo declarado bajo/medio no autoriza maniobras físicas. Las pruebas de riesgo alto no se proponen automáticamente.
- No se modifica el cifrado, autenticación, sincronización ni protección de la información local. Evitar datos confidenciales de clientes.
- La futura evaluación de facilidad de uso debe medir personas y tiempos reales frente a bitácoras, no el número de interacciones automatizadas.

## Integración

Cambio aislado a PRISMA en `ocre-os/apps` (PR #80) con tests dentro de `docs/tests/`. Conservar PR #75 para el piloto comparativo independiente; no tocar OCRE-OS Core ni publicar hasta verificación de la PR y del despliegue autorizado.