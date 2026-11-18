# Recursos visuales para UI/UX: VP0 y 21st.dev

Dos fuentes de referencia para diseñar interfaces de OCRE. Ninguna reemplaza el criterio del proyecto:
lo que llega al repo debe respetar la identidad de OCRE, la accesibilidad y las reglas de cada repo.

## VP0 (vp0.com)

Biblioteca gratuita de diseños de apps listos para que un agente los lea: cada diseño tiene una página
fuente estructurada (layout, colores, espaciado, componentes). Sin cuenta ni costo.

- **MCP:** `vp0` en `.mcp.json` (`npx -y vp0-mcp@0.3.0`). Pide diseños por nombre o pega un enlace
  `vp0.com/s/<diseño>` en el prompt.
- **CLI:** `npx vp0com add <diseño>`.
- **Ojo:** los diseños de VP0 son de **iOS (Expo / React Native)**. OCRE construye **web** (Next.js,
  PWA, HTML). Úsalos como **referencia de estructura, jerarquía, ritmo y espaciado**, no como código para
  pegar: se traducen a componentes web del proyecto y a la paleta y tipografía de OCRE.
- No copies marcas, nombres ni contenido de las apps de ejemplo.

## 21st.dev

Marketplace de componentes React/Tailwind y agente "Magic".

- **Plan gratuito:** un número limitado de **copias de componentes por día** (la web muestra cuántas
  quedan, p. ej. "2 free copies left today"). La generación con IA (Magic) **usa créditos de planes de
  pago**; en el plan gratuito no hay créditos de IA. Consulta el límite vigente en 21st.dev/pricing.
- **MCP:** `21st-magic` en `.mcp.json` (`@21st-dev/magic@0.2.3`). Necesita la variable de entorno
  `TWENTY_FIRST_API_KEY` (créala en la consola de 21st.dev y guárdala en tu entorno, **nunca en el
  repo**). Sin la variable el servidor no arranca y no pasa nada más.

### Cómo gastar la cuota diaria

1. Busca y compara en la web antes de copiar: navegar y previsualizar es gratis.
2. Copia solo componentes que vayas a integrar ese día, con un propósito concreto (p. ej. la animación
   del logotipo, un hero dinámico), no para "tenerlos".
3. Al integrarlo, adáptalo al stack del repo (en `ocre-os/web`: exportación estática, sin APIs ni
   `next/image` optimizado) y a la identidad de OCRE.
4. Registra en el commit de dónde vino: `Origen: 21st.dev/<autor>/<componente>` y su licencia.

## Codex

Codex no lee `.mcp.json`. Para usar los mismos servidores, agrégalos a `~/.codex/config.toml`:

```toml
[mcp_servers.vp0]
command = "npx"
args = ["-y", "vp0-mcp@0.3.0"]

[mcp_servers.21st-magic]
command = "npx"
args = ["-y", "@21st-dev/magic@0.2.3"]
env_vars = ["TWENTY_FIRST_API_KEY"]
```
