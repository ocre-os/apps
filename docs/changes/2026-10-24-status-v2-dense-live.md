# OCRE Status V2 — densidad informativa y continuidad de sondeos

**Fecha:** 2026-10-24. **Alcance:** interfaz estática en `apps.ocre.mx/os-status/`; sin cambios en backend ni credenciales.

## Principios implementados
- Sin medidores semicirculares. Ocupación = ranuras usadas / capacidad; cuota = porcentaje restante verificado, nunca progreso de tareas.
- El panel compacto mantiene acceso a la **totalidad** de las comprobaciones de plataforma, incluyendo fallas, degradaciones, sin señal y no configurado. Los detalles técnicos pueden expandirse sin perder la posición.
- El suavizado del monitor queda **aislado por URL del entorno**: cambiar CORE/STAGING reinicia historial y bloquea la contaminación por respuestas viejas, aunque ignoren AbortSignal. Dos pruebas de regresión reproducen ambos casos.
- Una cuota explícitamente agotada se muestra como **Agotada** incluso sin porcentaje; si existe hora de restablecimiento se conserva. La procedencia del monitor de agentes, cuotas y Xpress se indica expresamente como STAGING.
- Los agentes muestran actividad separada de ocupación, cuota, turno y restablecimiento. La autenticación queda como "Sin señal pública" hasta tener un contrato específico: ni estar trabajando ni disponer de cuota prueban autenticación.
- La pantalla mantiene información visible durante sondeos en segundo plano. Solo una carga inicial o cambio entre CORE/STAGING muestra placeholders; los datos tienen TTL y no se muestran vigentes si han caducado.
- "Sondeo 10 s" significa **polling** cada 10 segundos, no eventos push. La insignia indica comprobando, obsoleto o sin señal cuando corresponda.
- Navegación inferior y expandibles accesibles mediante teclado; controles con rótulo estable y aria-pressed. Respeto por `prefers-reduced-motion` y protecciones contra desbordes móviles.

## QA local
- `node --test os-status/*.test.js`: 109 pruebas aprobadas.
- `git diff --check`: sin problemas.
- Edge headless con datos sintéticos: comprobados estados, ocupación, alertas no configuradas, desarrollo y navegación; la captura de escritorio no sustituye pruebas en teléfono real.
- El HTML de QA usaba datos sintéticos en una ruta temporal eliminada del repositorio; no representa el estado real.
- El API de plataforma procede de `os.ocre.mx` / `staging.ocre.mx` según la pestaña. La actividad y cuotas de agentes proceden de `staging.ocre.mx`, indicadas como datos compartidos entre vistas. Hay temporizadores de caducidad y fallos desconocidos nunca se convierten en éxitos.

## Pendientes explícitos
- El endpoint público `ocre-devenv-v1` no publica autenticación Claude Windows/WSL ni cuota Claude verificable; evitar introducir datos privados en un tablero público.
- Verificación física de Android a 320-390 px y estabilidad bajo desconexión/reconexión.
- El polling de 10 s no es WebSocket/SSE. Antes de cambiar a push, se requiere diseño de seguridad, monitor de conexión y contrato de eventos.
- No prometer ausencia absoluta de fallos; operar con indicadores fail-closed y evidencia de pruebas.
