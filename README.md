# OCRE Apps

Portal de apps y herramientas internas de OCRE.

## Apps incluidas

- Portal general: `index.html`
- Limpiador Mozaik KDT: `limpiador-mozaik/index.html`
- Cizalla Hidraulica Krass: `cizalla/index.html`
- Escuadra Gantry: `escuadra/index.html`

## Publicacion

Este repo se publica como sitio estatico en `apps.ocre.mx` o en la ruta temporal del hosting que apunte a `/home/ocre/public_html/apps`.

El despliegue automatico esta configurado con GitHub Actions en `.github/workflows/deploy-ftp.yml`.

Secretos requeridos en GitHub Actions:

- `FTP_SERVER`
- `FTP_USERNAME`
- `FTP_PASSWORD`

La cuenta FTP debe apuntar directamente a `/home/ocre/public_html/apps`. El workflow despliega con `server-dir: ./`.

No guardes contrasenas FTP/SFTP dentro del repositorio.

## Estructura

```text
/
|- index.html
|- limpiador-mozaik/
|  `- index.html
|- cizalla/
|  |- index.html
|  |- manifest.webmanifest
|  |- service-worker.js
|  `- icons/
|- escuadra/
|  |- index.html
|  |- manifest.webmanifest
|  |- service-worker.js
|  `- icons/
|- postprocesadores/
|- docs/
`- LEEME.txt
```
