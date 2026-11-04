# PRISMA v0.6.2 — Guardado fiable y recuperación de emergencia

**Alcance:** exclusivamente `prisma/index.html` y pruebas/documentación. Sin IA, red, autenticación, servicios pagos ni modificación de OCRE-OS Core.

## Defecto real detectado en v0.6.1

La función `save()` capturaba la excepción de `localStorage.setItem` pero continuaba con un mensaje de «Guardado localmente». Si el almacenamiento estaba lleno, la vista cambiaba aunque al recargar se perdía el registro. Además, importación y restablecimiento podían declarar éxito sin persistir.

## Corrección

1. `save(candidate=state)` devuelve éxito únicamente tras escribir en `localStorage`. Los mensajes de éxito se condicionan a ese resultado.
2. Cuando falla una escritura, se muestra un **aviso persistente**, accesible mediante `role=alert`, y un botón «Descargar respaldo ahora» que exporta el estado todavía disponible en memoria.
3. La exportación normal y de emergencia comparten la misma función; archivo JSON compatible con `ocre_prisma_v05` / `version:5`.
4. Importar y restablecer son operaciones transaccionales: no cambian el estado visible hasta que su persistencia funciona. Si falla, se mantiene el trabajo anterior.
5. La advertencia desaparece sólo cuando una escritura posterior tiene éxito; no se afirma sincronización, cifrado ni resistencia a fallas del dispositivo.

## Prueba fallida antes de corregir

El test nuevo `docs/tests/prisma-v062/test_guardado_wsl.cjs` **falló** contra v0.6.1 al esperar una advertencia persistente bajo `QuotaExceededError`; se reprodujo exactamente el defecto.

## Pruebas tras el cambio

En Ubuntu 24.04/WSL, Node 22.23.2, Chromium y Playwright 1.63 (ya instalados):

```bash
cd /tmp/prisma-v062-final-20261104
export NODE_PATH=/home/ocre/src/ocre-os/core/frontend/node_modules
/home/ocre/.nvm/versions/node/v22.23.2/bin/node docs/tests/prisma-v062/test_guardado_wsl.cjs
/home/ocre/.nvm/versions/node/v22.23.2/bin/node docs/tests/prisma-v061/test_ui_wsl.cjs
/home/ocre/.nvm/versions/node/v22.23.2/bin/node --test docs/tests/prisma-v061/test_engine.cjs
```

**Aprobadas:** guardado normal, excepción de cuota, ausencia de falso mensaje, aviso persistente, respaldo de emergencia, importación en perfil nuevo, recuperación íntegra, rollback de importación/restablecimiento y regresiones de v0.6.1 (móvil a 390 px, resultados A/B explícitos, síntesis y corroboración). Motor 8/8.

## Limitaciones y siguiente validación

- Los respaldos deben descargarse y guardarse en lugar seguro; no están cifrados ni se sincronizan.
- La protección evita el **falso positivo de persistencia**, no elimina la dependencia del almacenamiento local.
- El sitio público puede recibir scripts de telemetría del hosting; evitar datos sensibles hasta evaluar privacidad.
- Antes de atribuir utilidad cotidiana, realizar una **prueba de usabilidad independiente**, no un benchmark automático. Por participante, medir: (a) registrar un problema y al menos una observación con fuente, (b) recuperar otro análisis ya creado y explicar sus límites, (c) exportar e importar respaldo en un perfil vacío. Registrar tiempo total incluyendo captura, éxito, errores, intervenciones del moderador y comentarios. Contrastar con el método habitual del participante y alternar el orden. Con cinco participantes se pueden detectar fricciones, **no inferir superioridad estadística**.
- La PR #75 de comparación PRISMA frente a ChatGPT es otro piloto; no mezclar sus resultados ni elevar pruebas de interfaz a evidencia de eficacia.
