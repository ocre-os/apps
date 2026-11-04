# Micro-Apps LAB — acceso privado y despliegue

## Estado esperado
- La demo estática en `https://apps.ocre.mx/micro-apps-lab/` se despliega dentro de la carpeta `micro-apps-lab/` del hosting ya contratado.
- El usuario `microapps-demo` tiene **credencial nueva** generada localmente, guardada en la ThinkPad en `/home/ocre/.local/share/micro-apps-lab/acceso-privado.txt` (permisos 0600).
- El hash bcrypt de la nueva credencial se guarda **exclusivamente** como secreto GitHub Actions `MICROAPPS_HTPASSWD`; el workflow crea un archivo temporal `.htpasswd` en el runner antes de FTPS. Nunca imprimir el contenido.
- Apache protege el directorio mediante Basic Auth por HTTPS. El archivo `.htpasswd` no debe estar versionado; se excluye con `.gitignore`.
- La contraseña/hash de la primera instalación se considera comprometida: **no volver a usar**. El hash antiguo persiste en el historial público de Git, aunque se eliminó del estado actual.

## Compuertas de verificación
1. Acción FTPS en `main` finalizada exitosamente en GitHub Actions.
2. Solicitud sin credenciales a `/micro-apps-lab/`: **401**, no 200 ni 500.
3. Solicitud con credencial nueva local: **200**. No exponer el valor en herramientas, logs ni mensajes.
4. Solicitud directa a `/micro-apps-lab/.htpasswd`: **403**.
5. Las páginas `/prisma/` y `/os-status/` siguen dando **200**, sin cambios funcionales.
6. `X-Robots-Tag` indica `noindex`. No equivale a aislamiento de seguridad.

## Consideraciones
- El laboratorio comparte origen (`apps.ocre.mx`) con otras utilidades. No introducir datos personales, fotos reales, firmas ni información confidencial. `localStorage` se comparte por origen, independientemente del directorio.
- Para un piloto comercial con datos reales, utilizar un **origen web separado** y validar aviso de privacidad y políticas de retención/borrado.
- No hay pasarela de pagos, cuentas de clientes ni backend de producción. Las tres ofertas son pruebas de mercado.
- Este flujo FTPS sincroniza archivos del repositorio completo `ocre-os/apps`. Verificar archivos cambiados y estado de otras apps antes de fusionar.

## Recuperación
Ante respuestas 500/403 inesperadas, mantener o restaurar `Require all denied` en `.htaccess` mientras se investiga. Nunca reactivar utilizando credenciales previas expuestas.
