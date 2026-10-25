# OCRE Status V2 — Interfaz compacta (2026-10-24)

## Decisión
Aplicar rediseño móvil a os-status a partir del diagnóstico visual del usuario y del mockup de tres vistas. Mantener datos de API existentes y compatibilidad de Matrix Mode. Desarrollo aislado, sujeto a pruebas y PR antes del despliegue.

## Problemas
- Gauges de 200×125 px para expresar únicamente ocupación (tareas activas/capacidad).
- Cabecera y tarjetas de dominios desproporcionadas.
- Información de plataforma y desarrollo duplicada en resúmenes de gran altura.
- Actividad/ocupación/cuota se confundían semánticamente. La API pública actual no aporta autenticación.

## Decisiones de interfaz
1. Sustituir gauges SVG por filas densas con nombre, actividad (ocre-agents-v1), ocupación segmentada y cuota (ocre-devenv-v1). Turno aparte.
2. Mostrar explícitamente **Autenticación: no evaluada** hasta que el backend publique un contrato validado; no inferir sesión desde cuota o actividad.
3. Resumen de plataforma, agentes y desarrollo en tres mosaicos pequeños; botón con foco y hit target accesible, contexto oculto solo visualmente.
4. Plataforma: cuatro servicios de vista previa y expansión explícita al resto, accesible por teclado. Resumen indica operativos entre servicios configurados.
5. Desarrollo desplegado, agentes secundarios y actividad reciente contraídos hasta petición; leyenda de estados plegada.
6. Mantener alertas reales; cuando no hay pendientes, mostrar línea compacta.
7. Mantener normalización estricta, HTML dinámico escapado, JS/CSS con cache busting y soporte reduced-motion.

## Fuera de alcance
- Autenticación Claude Windows/WSL y porcentaje Claude sin medición oficial; dependen de integración posterior de OCRE-074 y Status publicador.
- Nueva API, cambio de producción, cambio de algoritmo de cuotas, alteración de CI, permisos o autoejecución de agentes.
- Navegación por tabs o detalle de agente con operaciones privilegiadas del mockup; requieren contrato y autorización de backend.

## Criterios de aceptación
- Ningún gauge SVG en carga de agentes.
- Nunca mostrar porcentaje o autenticación inventados.
- Secciones condensadas con vista previa de cuatro servicios; expansión funcional y reversible.
- Estados y mensajes visibles incluso sin mediciones.
- Pruebas JS de Status y pruebas Python del publicador, revisión independiente y PR.
