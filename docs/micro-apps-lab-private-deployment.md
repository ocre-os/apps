# Micro-Apps LAB — seguridad de acceso y continuidad

## Estado vigente
- Laboratorio estático en `apps.ocre.mx/micro-apps-lab/`, independiente funcionalmente de OCRE-OS.
- Acceso **temporalmente suspendido** mediante `Require all denied` hasta rotar credenciales.
- La primera `.htpasswd` fue agregada a un repositorio **público**. El verificador y la contraseña compartida anteriormente se consideran comprometidos. Borrar el archivo de la rama principal **no elimina su presencia en el historial de Git**.
- No alojar información personal, documentos reales ni datos de clientes. El almacenamiento local del navegador es compartido por origen web con otras herramientas en `apps.ocre.mx`.

## Reactivación segura (requiere compuerta)
1. Generar una contraseña fuerte nueva **fuera de Git**, almacenarla en un gestor de credenciales, y configurar en GitHub Actions un secreto que contenga la línea `usuario:hash`, o aprovisionar el archivo de autenticación fuera del document root mediante canal administrativo seguro.
2. Adaptar el flujo FTPS para aprovisionar el archivo desde secretos y evitar que el hash o contraseña aparezcan en el repositorio, logs o artefactos.
3. Rehabilitar `AuthType Basic` con ruta exacta, requerir autenticación sobre HTTPS, y comprobar 401 sin credenciales, 200 con credenciales nuevas y 403 a archivos de configuración.
4. Retirar la contraseña antigua de cualquier cuenta compartida y mantener revocado su acceso. No afirmar que el historial Git quedó limpio.
5. Verificar `PRISMA` y `OCRE Status` después de la publicación.
6. Antes de pilotos con datos reales, establecer **origen propio y separado**, políticas de privacidad y controles apropiados de acceso.

## Alcance operativo
- No modificar OCRE-OS Core ni despliegues ajenos al subdirectorio `micro-apps-lab/`.
- No habilitar cobros ni registro de personas reales antes de validar demanda y cumplir la compuerta anterior.
- La publicación por GitHub Actions FTPS del repositorio `ocre-os/apps` afecta toda su raíz; no disparar cambios sin verificar el impacto.
