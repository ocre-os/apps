# PRISMA v0.5 — Piloto comparativo frente a una IA directa

**Estado:** PROTOCOLO PREPARADO / SIN RESULTADOS DE CAMPO  
**Fecha:** 2026-11-03  
**Repositorio:** `ocre-os/apps`. **Sin cambio de aplicación ni de OCRE-OS Core.**

## Objetivo y pregunta falsable

Investigar si PRISMA v0.5 mejora, frente a la consulta directa a un asistente general de IA, (1) la trazabilidad de afirmaciones, (2) la selección de comprobaciones que distinguen hipótesis y (3) la calidad de la conclusión revisada, sin elevar de modo injustificado el tiempo ni crear riesgos críticos. Tres casos no prueban superioridad estadística; son un piloto exploratorio.

## Línea base funcional comprobada

- Código evaluado: PRISMA v0.5 disponible en `main`; PR #74 fusionada.
- `node --test prisma/tests/test_engine.cjs`: **9/9** casos aprobados en evaluación local de 2026-11-03.
- `python prisma/tests/test_browser_v05.py`: recorrido Chromium aprobado, incluyendo migraciones, síntesis, patrones, contrastes, respaldo, tres escenarios sintéticos y móvil.
- **Importante:** los tres escenarios son **sintéticos**, no resultados de campo ni pruebas de eficacia del producto.

## Muestreo de casos

Seleccionar **tres problemas reales previamente resueltos** y autorizados para evaluación, uno de cada ámbito:
1. `M01`: maquinaria industrial (p. ej. causa verificada de desviación dimensional).
2. `S01`: software o sistemas (p. ej. regresión reproducible y corregida).
3. `A01`: administración (p. ej. discrepancia identificada mediante conciliación).

Registrar la resolución comprobada, pero mantenerla **fuera del paquete inicial**. No introducir datos identificables de clientes, credenciales ni información financiera sensible; PRISMA v0.5 guarda información en el navegador sin cifrado ni sincronización.

## Protocolo controlado

1. Preparar **el mismo enunciado y fuentes iniciales** para ambos métodos. Registrar versión de asistente, SHA-256 de fuentes y restricciones.
2. Comparar `PRISMA v0.5` con `IA directa` sin usar PRISMA. Mantener igual alcance, tiempo permitido y fuentes. Cronometrar **tiempo activo total**, incluida la carga de datos.
3. Alternar el orden por caso para reducir aprendizaje; anotar sesgos si el mismo evaluador ejecuta ambas condiciones.
4. Congelar las salidas antes de descubrir el desenlace. Un **revisor independiente y ciego al método** juzga cada afirmación y comprobación contra las fuentes.
5. Registrar las métricas **por corrida**. El cómputo no debe reemplazar revisión humana ni interpretar vacíos como ceros.
6. Conservar salidas, referencias y dictamen con el expediente. No ejecutar pruebas físicas de riesgo alto.

## Métricas predefinidas

| Métrica | Regla |
| --- | --- |
| Trazabilidad | Afirmaciones sustantivas con fuente válida / afirmaciones sustantivas totales; 0/0 = no evaluable |
| Capacidad discriminante | Comprobaciones que prevén resultados distintos entre hipótesis / comprobaciones totales, según revisión independiente |
| Tiempo | Minutos activos incluyendo captura de datos y elaboración de síntesis |
| Calidad | Rúbrica ciega 0–4: 0 peligrosa/incorrecta, 1 especulativa, 2 plausible insuficiente, 3 coherente sustentada parcialmente, 4 congruente con resolución verificada y límites |
| Seguridad | Conteo de errores críticos; **cualquier error crítico bloquea afirmar ventaja** |
| Certeza injustificada | Conteo separado de conclusiones que afirman más que la evidencia disponible |

## Criterios de salida

- **Preparado:** consentimiento verificado; tres paquetes de caso anonimizados y desenlaces sellados; instrumentación validada.
- **Ejecución completa:** seis corridas (tres por método), salidas congeladas, cronometraje y dictamen ciego.
- **Consolidado:** reporte descriptivo de diferencias por caso y método; sesgos declarados; recomendaciones para ampliar, modificar o suspender el piloto.
- **No demostrado:** no declarar que PRISMA supera a ChatGPT sin evidencia de campo; n=3 es exploratorio.

## Estado al registrar este documento

- Preparado: protocolo, plantillas CSV y evaluador de pares con validación de datos; prueba local del evaluador correcta.
- Ejecutado en PRISMA: 9 pruebas unitarias y recorrido de navegador.
- **Casos de campo recibidos: 0. Corridas reales: 0. Dictámenes ciegos: 0.**
- Pendiente: recopilar tres expedientes anonimizados y ejecutar seis corridas.

## Límites estructurales

PRISMA `rank()` cuenta pares de hipótesis distinguibles sobre predicciones declaradas por la persona; **no estima probabilidades**, no demuestra causalidad ni certifica procedimientos. Los contrastes de patrones son registros humanos. La evaluación debe vigilar sesgos de anclaje, confirmación, familiaridad con el caso y tiempo adicional de captura.

**Producto:** no modificar ni publicar PRISMA v0.6 como parte de este piloto. Separar datos operativos y privados de OCRE-OS Core.
