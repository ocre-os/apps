# PRISMA v0.6.2 — Cinco casos exitosos de foros (ensayo retrospectivo)

**Fecha de ejecución:** 2026-11-05 (México). **Resultado:** completado en navegador real, sin cambios al código de PRISMA.

## Qué se probó realmente

Playwright/Chromium en Ubuntu 24.04/WSL abrió `https://apps.ocre.mx/prisma/` en un perfil aislado. Para cada caso se introdujeron **síntomas, tres hipótesis redactadas por el operador y una comprobación futura**. Se verificó el ranking sin ejecutar la comprobación. Posteriormente se registró el desenlace publicado y se redactó una síntesis con su procedencia. Se exportó el respaldo JSON y se importó en un segundo perfil Chromium a 390 px; tras recargar persistieron los cinco expedientes. Todo el contenido procede de foros públicos, sin datos privados.

**NO es prueba ciega ni de eficacia diagnóstica**. El operador de la prueba conocía los desenlaces; PRISMA no generó las hipótesis ni encontró por sí mismo la causa. No se realizaron pruebas eléctricas, mecánicas, de red o de Excel; las comprobaciones permanecen como `pendiente`.

## Fuentes y resultados

| Caso | Fuente y confirmación | Comprobación propuesta por operador | Ranking motor | Resultado histórico |
|---|---|---|---|---|
| M01 | [Bambu P1S/AMS, shalev30](https://forum.bambulab.com/t/problems-with-loading-the-filament-from-ams-to-printer/28416) | Revisar logs del motor AMS | Elegible · 2/3 pares | Motor cambiado con éxito; otro usuario con síntomas similares precisó sustituir placa |
| M02 | [Bambu AMS 2 Pro, TheGenerals](https://forum.bambulab.com/t/ams2-pressing-ridges-into-the-filament-normal/255613) | Revisar geometría del hub sin intervenir equipo | Parcial · 1/3 pares y 2 desconocidos | Cambio de hub con éxito reportado |
| I01 | [Home Assistant MQTT, nickt444](https://community.home-assistant.io/t/mqtt-fails-identifier-rejected-after-broker-update-to-6-2-0/553193) | Inspeccionar parámetro keepalive | Elegible · 2/3 | El usuario corrigió keepalive a 60 |
| I02 | [MikroTik bridge, haitham94](https://forum.mikrotik.com/t/bridge-port-stuck-inactive-native-vlan-ether1-despite-correct-vlan-table-pvid-and-frame-types-ccr1016-12g-7-23-2/272780) | Inspección de configuración VRF en modo lectura | Elegible · 2/3 | Retirar asignación VRF especial activó puerto |
| A01 | [Excel Power Query, comunidad Microsoft](https://techcommunity.microsoft.com/discussions/excelgeneral/power-query-error-the-key-didnt-match-any-rows-in-the-table--when-combining/2443417/replies/3800562/) | Comparar nombres de pestañas/tabla | Elegible · 2/3 | Otra persona (no autor inicial) reportó solución renombrando una hoja en 18 libros |

La calidad probatoria es distinta: A01 corresponde a la experiencia de un **tercero en el hilo**, no al caso inicial. Las demás son soluciones autodeclaradas por sus autores, sin validación física independiente. En M01 hubo **dos causas diferentes con síntomas semejantes**: la comparación obliga a no convertir el primer resultado en una regla general.

## Comprobación técnica

- **5/5** expedientes creados; **15 hipótesis**, cinco comprobaciones propuestas y cinco síntesis.
- **4 elegibles / 1 parcial**, clasificación a partir de predicciones introducidas por el operador.
- **0/5 comprobaciones ejecutadas** sobre equipos reales.
- **0 errores JavaScript** en la sesión, exportación e importación.
- **205 interacciones automatizadas** en captura; una adicional para exportar. Son eventos de interfaz, NO minutos humanos.
- Segundo navegador aislado: **5/5 análisis restaurados**, más un ejemplo previo; JSON `version:5`, recarga sin pérdida, móvil 390 px sin desbordamiento.
- En todas las síntesis el motor informó `formalStatus:documentada`, `semanticVerified:false`, `corroboration:no_comprobada`, con cero alertas formales. **Cero alertas no equivalen a una conclusión verdadera**.

## Archivos

- [JSON importable, solo cinco casos](PRISMA-CINCO-CASOS-importar.json): conserva observaciones, hipótesis, comprobaciones pendientes y síntesis.
- [Salida JSON de medición](RESULTADOS-RAW-no-ciegos.json): ranking real del motor, límites y cronología de automatización.

**Precaución:** importar un JSON en PRISMA reemplaza los análisis locales del perfil. Abrir en un **perfil o navegador vacío** y hacer respaldo de cualquier trabajo antes de importar. PRISMA no cifra ni sincroniza los datos.

## Qué NO demuestra este estudio

No mide sensibilidad/especificidad de diagnóstico, tasa de aciertos, tiempos humanos ni superioridad sobre ChatGPT/bitácoras. No se debe contabilizar como prueba de usuarios del issue #85 ni como corridas ciegas del benchmark #76.

**Resultado de producto:** PRISMA ofrece estructura y trazabilidad con incertidumbre explícita, pero depende del juicio humano tanto para formular las pruebas como para interpretar las fuentes. La siguiente validación sigue siendo la usabilidad con cinco personas y la comparación verdaderamente ciega, si se desea demostrar eficacia.