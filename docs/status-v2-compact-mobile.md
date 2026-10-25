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
`node --test os-status/*.test.js` (110 pruebas en el commit de esta fase); `node --check` de los nuevos scripts; comprobación de navegador Chromium real a 390 px con muestras sanitizadas de los endpoints existentes. Verificar ausencia de overflow, cero SVG de velocímetros, funcionamiento de `details`, y que la UI no muestra autenticación ficticia.

## Conservación de información y actualización incremental (fase siguiente)
La interfaz compacta no elimina mediciones ni descripción de servicios: al desplegar Plataforma recupera el texto de cada servicio saludable, y al desplegar un agente muestra ejecución, reservas, turno, cuota restante, fecha de reinicio y autenticación (esta última se informa como «Sin señal pública» hasta que exista el contrato sanitizado). Si la fuente caduca, ambas filas siguen visibles, sin porcentajes ni reservas ficticias. La fecha de restablecimiento conocida se conserva como historial con etiqueta «vencido»; si es inválida o ya pasó, se invalida la cuota tanto en la tarjeta como en los resúmenes y alertas derivados.

La página consulta `ocre-devenv-v1` cada 10 segundos y actualiza la leyenda «Última muestra» cada segundo; **esto es sondeo periódico, no streaming continuo**. La telemetría vence a los 30 segundos y no debe presentarse como actual. El árbol DOM de tarjetas no se reconstruye si la representación visible no cambió, preservando expansión/foco. La comprobación de navegador utiliza datos de prueba; una prueba verde no acredita por sí sola la publicación en `apps.ocre.mx`.

## Fuera de alcance
Sin nuevas fuentes de datos, ni configuración de relogin, ni cambios en el backend, en el despliegue FTP, en credenciales o en políticas de ejecución de agentes. El diseño requiere review previo a merge; el publicador existente no cambia automáticamente por un PR.
