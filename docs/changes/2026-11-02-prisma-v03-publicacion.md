# PRISMA v0.3 — publicación experimental en OCRE Apps

- Fecha de autorización: 2026-11-02 (America/Cancun).
- Alcance: publicar el laboratorio autónomo `prisma/index.html` y enlazarlo en el catálogo `index.html`.
- Separación: PRISMA no crea ni modifica Solicitudes, Diagnósticos, Sesiones, Servicios, Casos o Activos de Core.
- Estado: **experimental**; no es software certificado de diagnóstico, ni plataforma multiusuario.
- Datos: únicamente almacenamiento local del navegador, sin cifrado ni sincronización; evitar datos confidenciales o de clientes en equipos compartidos. Exportar JSON para conservar información.
- IA: no conectada; la selección de comprobaciones usa predicciones declaradas por la persona, sin calcular probabilidades ni certificar diagnósticos.
- Seguridad física: las comprobaciones con riesgo alto quedan excluidas de recomendaciones automáticas y no se autorizan intervenciones de maquinaria.

## Pruebas previas a publicación

1. Node.js `--test prisma/tests/test_engine.cjs` sobre el paquete fuente local: **7/7 aprobadas**.
2. Chromium headless con HTML autónomo: renderizado, ausencia de errores JavaScript y apertura del diálogo «Nuevo análisis»: **aprobadas**.
3. Pendiente de comprobar después del merge: acceso HTTP a `https://apps.ocre.mx/prisma/`, ficha del catálogo y estado del workflow FTP.

La publicación se realiza en `ocre-os/apps`, sin cambios en `ocre-os/core`. Los test y casos de benchmark son artefactos de desarrollo y no se colocan en el sitio publicado.
