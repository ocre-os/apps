# Micro-Apps LAB v0.2 — despliegue de prueba

Esta micro-app es independiente de OCRE-OS y no modifica Core.

## Alcance
- Sitio: /micro-apps-lab/
- Demo estática con tres micro-apps y módulo de validación.
- Sin backend, pagos, analítica remota ni datos reales de clientes.
- Acceso Apache Basic Auth; usuario temporal entregado privadamente; reemplazar antes de pruebas externas.
- El origen se comparte con apps.ocre.mx. Por eso no debe usarse con datos personales reales: el localStorage se comparte por origen y cualquier script del mismo origen puede acceder. La protección por ruta no equivale a aislamiento de origen.

## Validación
- Comprobar código 401 sin credenciales y 200 con credenciales.
- Comprobar TLS, X-Robots-Tag y que /.htpasswd no sea accesible.
- Verificar EntregaOK, ComparaBien, EventoMínimo y registro local.
- No anunciar públicamente el sitio, no habilitar pagos.

## Restricciones
- El workflow FTP existente sincroniza la raíz del repositorio: no modificar .github/workflows/deploy-ftp.yml ni las demás apps.
- La ruta AuthUserFile supone el DocumentRoot indicado en .cpanel.yml. Si difiere, Apache responderá con error en lugar de exponer el contenido; actualizar solo tras verificar la ruta real.
- Para un piloto con datos reales se requiere origen independiente, aviso de privacidad y controles de acceso adecuados.
