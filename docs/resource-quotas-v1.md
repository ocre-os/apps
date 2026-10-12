# OCRE Status — inventario de recursos y cuotas (propuesta v1)

**Estado:** interfaz implementada en rama de revisión, **sin telemetría backend ni publicación**. El sitio `apps.ocre.mx` es público; nunca enviar llaves, identificadores de cuenta, saldos monetarios sensibles ni límites de una cuenta privada a ese sitio sin aprobar acceso/privacidad.

## Inventario priorizado

| Recurso | Qué influye en el flujo | Fuente inicial fiable | Límites |
| --- | --- | --- | --- |
| ChatGPT | Capacidad de conversación, investigación, coordinación | Interfaz de la cuenta / fuente oficial si existe | No inferir cuotas del plan |
| ChatGPT Work | Ejecuciones de Work delegadas | Estado oficial del producto | Separar cuota Work de ChatGPT |
| Codex | Desarrollo agentic y CLI | `scripts/agent-quota.py` (`account/rateLimits/read`) | Ventanas primaria/secundaria y reset; autenticar aparte |
| Claude | Implementación alternativa y failover | Eventos de límites y `claude auth status` existentes | Eventos puntuales no equivalen a saldo actualizado |
| GitHub Actions | Minutos CI, concurrencia, almacenamiento | API de GitHub, según permisos | Minutos, runner y límites de cuenta son magnitudes diferentes |
| Desktop Commander | Lectura/edición remota desde ChatGPT | Herramienta `get_usage_stats` | Cuota por cuenta/conexión y fecha de reinicio, si se informa |
| OpenAI API | Uso de API y costes, túnel | APIs oficiales de uso/límites cuando autorizadas | Distinto de cuota ChatGPT, Work y Codex |
| Anthropic API | Uso de API externo, si se emplea | Consola/API autorizada | No confundir con Claude plan/CLI |
| MCP Tunnel | Disponibilidad/conectividad del puente | Doctor/health y comprobación MCP | Conectividad no significa cuota restante |
| Hosting/VPS | Continuidad del proyecto/servicios | Health, disco y recursos locales | Capacidad no es cuota de modelos |

## Contrato v1 de lectura (NO endpoint actualmente confirmado)

`GET https://staging.ocre.mx/api/resource-quotas`; propuesta de endpoint agregador protegido y sanitizado. Hasta implementarlo, el cliente mostrará **Sin datos** en todas las tarjetas. No usar consultas del navegador directamente a APIs privadas ni insertar tokens en JavaScript público.

```json
{
  "contract": "ocre-resource-quotas-v1",
  "observed_at": "2026-10-12T14:00:00Z",
  "services": {
    "codex": {"state": "limited", "remaining": 12, "unit": "percent", "resets_at": "2026-10-12T17:00:00Z", "source": "cli", "observed_at": "2026-10-12T14:00:00Z"}
  }
}
```

Muestra ejemplificativa, **no una medición real**. Los estados son `available`, `limited`, `exhausted`, `unknown`; las unidades `percent`, `minutes`, `requests`, `credits`, `usd`. Medición con más de cinco minutos de antigüedad, tiempos futuros o datos inválidos ⇒ `unknown`; reset vencido ⇒ no presentar una fecha futura inventada. Un `reset` previsto **no prueba** que la cuota haya vuelto: debe releerse. El frontend no puede inferir el estado `available` porque pasó el tiempo.

## Política de selección operacional propuesta (sin activación)

- **Desarrollo intenso:** comprobar cuota reciente/autenticación de Codex y Claude, coste autorizado y ventana de reset antes de admitir tareas; elegir proveedor por contrato, aislamiento y recursos; usar GitHub Actions para CI según presupuesto.
- **Operación diaria:** preferir diagnósticos y pruebas deterministas de bajo coste; reservar modelos para incidencia, decisiones y correcciones.
- **Cambios posteriores:** ejecutar QA/CI y publicar sólo tras evidencia; poner tareas en espera si no hay cuota y reconsultarlas al llegar `retry_at`. Nunca hacer failover infinito.
- **Desconocido:** no equivale a agotado ni a disponible. La admisión sigue `agent-quota.py` y reglas OCRE-024/039/048; la vista de Status es informativa, no una nueva autoridad de ejecución.

## Adaptadores incrementales existentes

`os-status/quota-adapters.js` incorpora funciones puras `codex(snapshot, nowSeconds)` y `claude(snapshot, nowSeconds)` que aceptan **únicamente** resultados agregados de `scripts/agent-quota.py` en Core; no leen credenciales, cuentas ni API privadas. Rechazan lecturas incompletas, caducadas o ventanas de reset vencidas, y usan la ventana más restrictiva para porcentaje restante. Son utilidades de transformación **para un futuro agregador servidor**, no se cargan en el navegador ni convierten el sitio público en lector de cuotas. `codex.blocked` significa agotado aunque resten porcentajes. No se presupone que las fuentes de Claude sean eventos recientes fiables hasta recibir ambas ventanas normalizadas.

**Pendiente una decisión de privacidad/acceso** antes de conectar estas funciones a un endpoint real. El PR no constituye autorización para exponer estas métricas en la URL pública.

## Entrega pendiente

1. Resolver privacidad y autenticación del agregador: separar detalle privado para coordinación y un resumen público aprobado.
2. Conectar fuentes existentes de Codex/Claude, GitHub Actions y Desktop Commander sin almacenar credenciales en el frontend.
3. Comprobar fuentes oficiales para Work/ChatGPT; marcar no medible si no existe dato autorizado.
4. Añadir pruebas de contrato y UI; verificar en staging antes de considerar despliegue de `apps/main`.

No se aprueban nuevas reglas de seguridad, gastos ni publicación por este documento.
