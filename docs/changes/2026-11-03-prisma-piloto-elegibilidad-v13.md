# PRISMA — Evaluación de admisibilidad del piloto v1.3

**Fecha:** 2026-11-03. **Estado:** TRES CANDIDATOS DOCUMENTALES / 0 CORRIDAS REALES. No se modifican `prisma/`, la versión pública v0.5 ni OCRE-OS Core.

## Decisiones de selección de casos

| ID | Dominio | Fuente / robustez | Admisibilidad |
| --- | --- | --- | --- |
| **S01** | Sistemas | Incidente real de OCRE Status, PR pública `ocre-os/apps#52`; existe corrección documentada | Candidato; comprobar operador sin conocimiento previo y revisión independiente |
| **M02** | Maquinaria (fabricación aditiva) | Foro público Bambu Lab, informe del propietario de impresión corregida tras asegurar fijaciones; evidencia autodeclarada | Candidato alternativo público; no es maquinaria industrial pesada ni prueba causal independiente |
| **A01** | Administración / control interno | Informe oficial del Audit Office of New South Wales, 2025; cambio de datos de proveedor, pago revertido y controles corregidos | Candidato documental sólido; no hay expediente transaccional completo para replicar |
| M01 | Limpieza láser industrial | Relato privado de intervenciones y resultado observado | **NO HABILITADO**: falta permiso expreso y pruebas de desenlace; varias intervenciones simultáneas |
| A01-ERPNext | Software contable | GitHub público: incidente #43275 y corrección #44545 | Archivado como respaldo de software; no utilizar como caso puramente administrativo |

## Notas de validez

1. Los expedientes A01 y M02 han sido **reconstruidos para plantear el punto de decisión**, sin soluciones en la copia para investigadores; los desenlaces históricos están en paquete separado de revisor.
2. La fuente de M02 sólo aporta autoinforme de resolución, sin metrología. No se debe premiar que un investigador adivine un componente concreto sin evidencia.
3. El investigador **no puede usar el repositorio, búsqueda externa ni el paquete del revisor** durante la corrida. Dado que los casos son públicos, debe declarar si los conocía de antemano; excluir corridas contaminadas.
4. Cualquier auditoría técnica debe distinguir eficacia real, calidad de razonamiento y familiaridad previa.
5. El evaluador mide atributos del expediente evaluado; **0/6 corridas** hasta contar con operadores independientes y seis salidas congeladas.

## Instrumentación v1.3

Archivos nuevos en `docs/tools/prisma-pilot/`: `verificar_artefactos.py`, `test_verificar_artefactos.py`, plantilla de manifiesto y README actualizado.

- `python3 -m unittest discover -v`: **24/24** pruebas (17 previas + 7 de integridad).
- `python3 verificar_artefactos.py PLANTILLA-corridas-v1.1.csv PLANTILLA-manifiesto-artefactos-v1.json --root .`: estructura vacía validada, **0 archivos y 0 corridas**.
- Verifica hashes sobre archivos, enlazando SHA iniciales y salidas congeladas con cada corrida; impide referencias a ficheros fuera de la raíz.
- No confirma permisos, identidad del revisor, origen genuino ni ausencia de sesgos: estas compuertas siguen siendo humanas.
- Los dos scripts versionados son exactamente los probados localmente (comparación textual) antes del registro.

## Publicación y privacidad

Las herramientas viven en `docs/**`, excluido por el workflow FTP. Este cambio **no se debe fusionar automáticamente** hasta revisión de método, privacidad y diff. Si se fusiona después de revisión, sólo se integrará documentación; no se publicarán expedientes ni desenlaces de clientes.
