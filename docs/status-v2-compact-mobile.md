# OCRE Status V2 — compactación móvil (propuesta)
Fecha: 2026-10-24 · Rama: feat/status-v2-compact-mobile

## Objetivo y alcance
Reducir alto y scroll de la pantalla pública `apps.ocre.mx/os-status/` sin alterar los contratos `ocre-status-v1`, `ocre-agents-v1` y `ocre-devenv-v1`, ni el modo Matrix.

La vista reemplaza los antiguos velocímetros de carga (inadecuados para contar tareas) por filas expandibles de Claude y Codex. La fila presenta estado de ejecución de `ocre-agents-v1`, ocupación como `slots_used/capacity` de `ocre-devenv-v1`, y cuota porcentual solamente si el estado de cuota es válido y el backend informa un valor numérico. La autenticación no existe todavía en esos contratos públicos: se declara «Sin señal pública» y nunca se infiere de estado, ocupación o cuota.

El veredicto, dominios y atención se comprimen. La plataforma expone los cuatro primeros servicios y todas las filas no saludables; los servicios adicionales saludables y no configurados se despliegan manualmente. Las secciones siguen siendo expandibles, visibles para lectores de pantalla y respetan `prefers-reduced-motion`.

## Datos y semántica
- **Trabajando / Disponible / En espera / Sin señal**: ejecución observada, no utilización de capacidad.
- **Ocupación**: tareas reservadas sobre la capacidad medida, no porcentaje de avance.
- **Cuota**: porcentaje restante del proveedor solo si viene del contrato validado; «Sin medición» si falta.
- **Autenticación**: no publicada en esta fase. La integración posterior OCRE-074/PR #277 debe aportar estado por runtime con contrato y sanitización propios; no mezclar Claude Windows y WSL.
- **Estado de la plataforma**: los problemas no desaparecen al plegar filas; se conservan en Requiere atención.
- **Desarrollo**: validación y supervisor permanecen como datos diferenciados y no se infieren del estado de Xpress.

## Validación local
`node --test os-status/*.test.js` (86 pruebas); `node --check` de los nuevos scripts; comprobación de navegador Chromium real a 390 px con muestras sanitizadas de los endpoints existentes. Verificar ausencia de overflow, cero SVG de velocímetros, funcionamiento de `details`, y que la UI no muestra autenticación ficticia.

## Fuera de alcance
Sin nuevas fuentes de datos, ni configuración de relogin, ni cambios en el backend, en el despliegue FTP, en credenciales o en políticas de ejecución de agentes. El diseño requiere review previo a merge; el publicador existente no cambia automáticamente por un PR.
