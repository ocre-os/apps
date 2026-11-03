# PRISMA v0.4 — Síntesis trazable (2026-11-02)

Estado: **implementada y validada localmente; publicación sujeta al workflow de Apps**.

## Alcance
- Nueva sección de síntesis con conclusión humana, límites e incertidumbres obligatorios.
- Fuentes tipadas como observaciones y comprobaciones completadas, clasificadas a favor o en contra.
- Versionado por adición (nuevas síntesis; no se sobrescriben las anteriores).
- Revisión determinista de fuentes inválidas, duplicadas, ausentes, pendientes, predicciones contradictorias y evidencia derivada duplicada.
- Copiar síntesis con identificadores de fuente y respaldar en JSON v0.4.
- Migración no destructiva de localStorage de v0.3 y JSON v0.1–v0.3. La app conserva la clave anterior para recuperación.

## Evidencia reproducible
El paquete de desarrollo PRISMA v0.4 se entregó con fuentes y los comandos siguientes:

- `node prisma/tests/test_engine.cjs` — **9/9 pruebas aprobadas**.
- `python prisma/tests/test_browser.py` — recorrido completo en Chromium, incluyendo migraciones, hipótesis, contraste, creación de dos versiones de síntesis, exportación JSON, móvil y sanitización de títulos: **aprobado**, sin errores JavaScript.
- La versión publicada es HTML autocontenido en `prisma/index.html`.

## Límites
PRISMA no es un Servicio, una Sesión, un Diagnóstico ni un Caso de OCRE-OS. No autentica ni sincroniza, no cifra los datos locales ni certifica diagnósticos. Las alertas son indicativas. Se muestran hasta 100 observaciones y 100 comprobaciones realizadas más recientes en el selector de fuentes. Requiere validación con usuarios en casos reales antes de afirmar eficacia.
