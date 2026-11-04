# PRISMA: ejecución del piloto exploratorio v1.4

**Estado:** sin corridas reales ni revisión ciega; **0/6**. Esta carpeta queda excluida del despliegue FTP de Apps por `docs/**`.

## Instrumentos versionados

- `evaluar.py` y `test_evaluar.py`: integridad lógica de corridas, métricas descriptivas; **17 pruebas**.
- `verificar_artefactos.py` y `test_verificar_artefactos.py`: archivos físicos de entrada y salida de las corridas; **7 pruebas**.
- `verificar_fuentes.py` y `test_verificar_fuentes.py`: seis expedientes de origen, SHA-256 y separación de ZIP por rol; **14 pruebas**.
- Plantillas CSV para corridas. Los datos de las pruebas son ficticios, no resultados del piloto.

Para reproducir desde esta carpeta (Python 3.10+ y sin dependencias externas):

```bash
python3 -m unittest -v test_evaluar.py test_verificar_artefactos.py test_verificar_fuentes.py
python3 evaluar.py PLANTILLA-corridas-v1.1.csv
```

Esperado: **38/38 pruebas correctas**, `cases_seen=0`, `paired_cases=0`, `can_claim_superiority=false`.

## Dos manifiestos diferentes

El paquete de coordinación v1.4 (entregado por separado) contiene tres enunciados bajo `investigador/`, tres desenlaces bajo `revisor/`, y `coordinacion/MANIFIESTO-SHA256.json` con esquema `prisma-pilot-source-files-v1`.

Comprobar el material fuente y ambos ZIP de distribución antes de reclutar:

```bash
python3 verificar_fuentes.py --root /ruta/paquete-extraido \
  --manifest /ruta/paquete-extraido/coordinacion/MANIFIESTO-SHA256.json \
  --investigador /ruta/PRISMA-PILOTO-v1.4-investigador.zip \
  --revisor /ruta/PRISMA-PILOTO-v1.4-revisor.zip
```

Para las **salidas de las corridas**, `verificar_artefactos.py` exige otro manifiesto, `prisma-pilot-artifacts-v1`, vinculado a los SHA-256 declarados en el CSV. Estos manifiestos **no son intercambiables**.

## Personal, ceguera y comparabilidad

1. La persona coordinadora mantiene separados los archivos de rol. No subir a GitHub los desenlaces, los datos de clientes, los registros del ensayo ni el paquete completo.
2. Verificar desconocimiento de la solución para cada operador. Dos operadores diferentes y comparables por caso: uno usa PRISMA, otro una IA directa. Alternar la asignación y mantener las mismas instrucciones y fuentes. Registrar tiempos activos completos.
3. Congelar las seis salidas y sus hashes. Un revisor independiente recibe salidas **sin identificar el método** y el expediente de desenlace; no puede ser operador de ese caso. Registrar cualquier conocimiento previo del caso.
4. Dictamen exploratorio sólo después de **3 pares completos**, con fuentes comprobadas y advertencias de sesgos. **n=3 no demuestra superioridad**, y cualquier error crítico impide una conclusión favorable.
5. Mantener PRISMA v0.5 y OCRE-OS Core sin cambios durante el experimento.

El hecho de que una prueba técnica pase **no** certifica elegibilidad de los casos, autorización, ceguera humana ni eficacia del producto. La auditoría metodológica está en `docs/changes/2026-11-03-prisma-piloto-auditoria-v11.md`.
