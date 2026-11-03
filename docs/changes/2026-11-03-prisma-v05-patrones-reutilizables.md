# PRISMA v0.5 — Patrones reutilizables

Estado: IMPLEMENTADA / en verificación de publicación
Fecha: 2026-11-03

## Alcance

La aplicación de Apps añade una biblioteca local de candidatos de patrón extraídos de una Síntesis trazable, con revisión humana y contraste documentado en análisis diferentes al de origen. No modifica OCRE-OS Core, ni Solicitudes, Sesiones, Servicios, Casos, permisos o contratos operativos.

## Contrato de términos

- **Candidato de patrón**: extracción humana de una síntesis con al menos una fuente válida a favor. Conserva instantánea de conclusión y datos de fuente. No se convierte automáticamente en conocimiento verificado.
- **Patrón revisado**: ficha con responsable y fundamento de revisión; sólo es revisable cuando la síntesis origen carece de advertencias formales. Revisado no significa certificado.
- **Contraste**: anotación de compatibilidad, contradicción o resultado inconcluso en un análisis distinto. Para compatibilidad o contradicción exige vincular observaciones o comprobaciones realizadas del nuevo análisis.
- **Retirado**: conserva procedencia e historial; no permite nuevas aplicaciones.

## Compatibilidad y protección

Almacenamiento versionado nuevo `ocre_prisma_v05`; migra desde v0.4/v0.3/v0.2/v0.1 sin sobrescribir las claves antiguas. Respaldo importable/exportable JSON v5. El almacenamiento permanece sólo en el navegador; no hay autenticación, cifrado, sincronización, IA ni conexión con Core. Evitar información confidencial en dispositivos compartidos.

## Verificación local previa a PR

- `node --check` en app y motor: correcto.
- `node --test prisma/tests/test_engine.cjs`: 9/9 correctas, sin regresiones del motor.
- Playwright/Chromium: formulario, revisión, bloqueo en análisis de origen, rechazo de contraste sin fuentes, contraste contradictorio documentado, migración no destructiva, datos heredados v0.1–v0.4, importación/exportación, tres escenarios sintéticos, móvil y escape HTML: correcto.
- Las pruebas evalúan funciones de software; **no** certifican calidad diagnóstica en campo.

## Publicación

El despliegue de Apps ocurre al integrar en `main`, mediante el workflow FTP existente. Verificar versión pública y contenido servido después de integración; no inferir despliegue exitoso sólo porque se fusionó la PR.

## Riesgos abiertos

No compartir análisis entre dispositivos; resultados declarativos, no garantía causal; revisión humana sin autenticación verificable; falta validación con casos reales.