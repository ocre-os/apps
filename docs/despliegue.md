# Despliegue de apps.ocre.mx

## Objetivo

Publicar este repositorio como sitio estatico en el subdominio `apps.ocre.mx`.

## Opcion recomendada

Usar GitHub Actions con SFTP o FTP hacia la carpeta del subdominio en GoDaddy/cPanel.

## Secretos necesarios

Crear estos secretos en GitHub cuando tengamos los datos del hosting:

- `FTP_SERVER`
- `FTP_USERNAME`
- `FTP_PASSWORD`
- `FTP_TARGET_DIR`

Si el hosting permite SFTP/SSH, conviene usar SFTP en lugar de FTP.

## Pendiente

Cuando existan los secretos, se puede activar un workflow de despliegue automatico al hacer push a `main`.

No se incluye un workflow activo todavia para evitar despliegues fallidos antes de configurar credenciales.
