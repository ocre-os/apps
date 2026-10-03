# Matrix Mode: telemetría vertical

Solicitud: mostrar datos reales de arriba abajo y aumentar claramente la densidad, aceptando menor legibilidad. El usuario autorizó expresamente rama, pruebas, commit, push, PR y merge reversible a Apps main. OCRE-024 revisado en Core; este alcance no modifica Core ni staging.

La telemetría conserva el contrato real y se escribe mediante glifos individuales, sin rotar letras. Las secuencias se revelan hacia abajo, después descienden y se reciclan. Los datos nuevos reemplazan los anteriores y limpian sus trazas. La lluvia pasa de un plano cada 10px a tres planos cada 7/9/13px con tamaños, intensidades y velocidades diferentes; las colas cubren la pantalla desde el inicio y durante todo el ciclo. El rótulo de telemetría también es vertical. El control de salida mantiene su orientación convencional.

Render limitado a 25fps, resolución hasta 2x y pasos de tiempo acotados. Con movimiento reducido se muestra una composición estática, redibujada únicamente al entrar, cambiar datos o redimensionar.

Validación: 6 pruebas existentes y 4 pruebas de render (dirección y contenido reales, densidad móvil/desktop, actualización/revelado y cancelación). Sintaxis y diff comprobados. Vista local inspeccionada en Chromium a 1440×900 y 390×844: pantalla densa, verde, scanlines, telemetría vertical y salida visible. Los endpoints rechazan el origen localhost mediante CORS; el estado local de conexión no se interpreta como falla de Core. La comprobación sanitaria final se realiza desde apps.ocre.mx después de publicar.

CI: pruebas sin dependencias con Node 22 y timeout de tres minutos. Reversión: revertir esta PR en Apps main y permitir que el despliegue FTP existente publique la versión anterior.

## Seguimiento de publicación

PR #3 fusionada a main en 89acee7. CI de main y despliegue FTP #55 completados correctamente. La verificación real encontró una sesión que retenía el Matrix anterior: se versionan las referencias a matrix.js y styles.css para forzar la descarga de los nuevos recursos. Core devolvió Cloudflare Tunnel error 1033 durante la comprobación; no se modificó Core ni staging y la UI conserva el estado de conexión real. La validación final de Matrix se repite con los recursos versionados.
