OCRE Tecnologías — Cizalla Hidráulica V3 PWA

INSTALACIÓN EN HOSTING
Sube TODO el contenido de este ZIP a la raíz de:
https://cizalla.ocre.mx/

Archivos necesarios:
- index.html
- manifest.webmanifest
- service-worker.js
- icons/icon-192.png
- icons/icon-512.png

COMPORTAMIENTO
1. Si hay internet:
   - La navegación usa prioridad de red (network-first).
   - Se intenta cargar la versión publicada en el servidor.
   - Se actualiza la copia offline.
   - El navegador comprueba si hay un service worker nuevo.

2. Si no hay internet:
   - Se abre la última versión válida guardada en caché.
   - Los cálculos funcionan offline.

3. Actualizaciones:
   - Al abrir la aplicación se solicita una comprobación de actualización.
   - Al recuperar conexión también se vuelve a comprobar.
   - Si existe una nueva versión del service worker, aparece “Hay una versión nueva disponible”.
   - Al pulsar “Actualizar ahora” se activa la versión nueva y se recarga la app.
   - NO es necesario volver a instalar la PWA.

IMPORTANTE
Una PWA no puede descargar una actualización mientras el teléfono está totalmente
sin conexión ni garantiza ejecución en segundo plano si el sistema operativo ha
cerrado la app. La actualización se detecta al abrirla o al volver a tener conexión.

ANDROID / CHROME
Puede aparecer el botón “Instalar aplicación”. También se puede instalar desde el
menú del navegador.

iPHONE / SAFARI
Usa Compartir > Añadir a pantalla de inicio. iOS no expone beforeinstallprompt como Chrome.

REQUISITO
El sitio debe servirse por HTTPS. cizalla.ocre.mx debe tener certificado SSL válido.
