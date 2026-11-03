# PRISMA — Instrumentos del piloto comparativo v1.1

**Estado:** código de evaluación reproducible; **0 corridas reales**. Esta carpeta es documental y queda excluida del despliegue FTP de Apps por la regla `docs/**`.

## Qué hace

`evaluar.py` valida declaraciones CSV de hasta dos métodos por caso (`prisma` y `ia`), comprueba integridad básica (pares, SHA declarados, orden, contadores, tiempos positivos, revisor distinto del operador) y produce JSON descriptivo. **No comprueba archivos originales, autorización, verdad de los juicios humanos ni cegamiento**. `can_claim_superiority` es siempre `false`: el piloto exploratorio de tres casos no certifica superioridad.

## Reproducir

Requisitos: Python 3.10 o superior. No se necesitan dependencias ni red.

```bash
cd docs/tools/prisma-pilot
python3 -m unittest -v test_evaluar.py
python3 evaluar.py PLANTILLA-corridas-v1.1.csv
```

Esperado en la plantilla vacía: **17/17 pruebas unitarias**, `cases_seen: 0`, `paired_cases: 0`, `can_claim_superiority: false`. Los ejemplos internos de las pruebas son **ficticios**, no resultados del piloto.

## Custodia y privacidad

Las dos plantillas contienen **sólo encabezados**. No subir en Git datos personales, secretos ni expedientes de clientes. Mantener separados:
- Enunciados para la persona investigadora, sin desenlaces.
- Desenlaces y comprobaciones originales, accesibles solo al revisor.
- Salidas congeladas y cronometraje para su contraste ciego.

Versionar el código de evaluación **no** autoriza usar expedientes ni implica fusionar esta PR. El protocolo y la auditoría se describen en `../../changes/2026-11-03-prisma-piloto-comparativo-v1.md` y `../../changes/2026-11-03-prisma-piloto-auditoria-v11.md`.

## Criterio de elegibilidad

Para cada caso: problema real, resolución documentada, permiso de uso y anonimización, mismo material de partida para ambas condiciones, sin conocimiento previo del desenlace por los operadores, tiempo total medido y revisión independiente ciega. No declarar superioridad con n=3; cualquier error crítico impide una conclusión favorable.
