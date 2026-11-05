# Guion del moderador — PRISMA v0.6.2

**No se ha evaluado a ninguna persona todavía.** Registrar solo alias P01–P05, perfiles generales y tiempos. Requiere consentimiento voluntario y sin grabaciones por defecto.

## Preparación

1. Reclutar cinco personas voluntarias; mínimo dos técnicos.
2. Asignar código P01–P05 y verificar consentimiento; no publicar nombres ni lista identificadora.
3. Comprobar que PRISMA público muestra v0.6.2. Preparar un **perfil de navegador limpio por persona** y otro perfil vacío para la restauración; no tocar datos existentes de nadie.
4. Repartir las tarjetas A/B según `asignaciones.csv`. No entregar desenlaces ni pistas ni resultados ajenos.

## Captura por condición

Tiempo desde lectura del escenario hasta que termina la captura o se alcanzan 8 minutos (480 segundos). Éxito requiere **descripción, hecho observado y procedencia**; hipótesis o siguiente prueba son opcionales y se registran como observaciones cualitativas. El moderador no muestra dónde pulsar ni sugiere causas; registrar ayudas necesarias. Para PRISMA comprobar guardado real al recargar **solo si no hay advertencia**. Si falló, recuperar con descarga de emergencia antes de recargar y registrar error.

## Después de capturar

- **Recuperar** en PRISMA (≤300 s): localizar el análisis y comunicar qué se sabe y qué falta.
- **Respaldar** (≤480 s): exportar JSON, abrir otro perfil vacío, importar y verificar el hecho y fuente originales. Guardar en `tareas.csv` si se restauró.
- **Diferida** (≤300 s): 7 días después ±1; localizarlo y explicar límites. Registrar si usó navegador original o archivo exportado. Si no participa no inventar una fila.

## Medición

`capturas.csv`: una fila por condición/persona, tiempo entero segundos ≤480, éxito, ayudas, error crítico y notas; dos filas máximo por persona. `tareas.csv`: una fila para recuperar, respaldar y diferida. No inferir eficacia diagnóstica.

Cualquier pérdida silenciosa, interpretación peligrosa o respaldo irrecuperable bloquea ampliación. No publicar CSV sin revisar privacidad; GitHub recibe el **resumen anónimo** después del piloto.
