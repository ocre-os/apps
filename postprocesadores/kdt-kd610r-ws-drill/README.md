# KDT KD-610R / WS Drill - Mozaik MPR postprocessor

Referencia del postprocesador usado para generar MPR desde Mozaik hacia KDT KD-610R / WS Drill.

## Hallazgo 2026-09-24

El postprocesador define:

```txt
<HomagExtraHBoreLine>
Value = ??="_ABD"
```

Esa linea inserta `??="_ABD"` dentro de macros `<103 \Horizontal drilling\`.

En WS Drill aparece como condicion de habilitacion `ABD`; si el archivo MPR no define una variable `ABD`, Drill Tech la marca en rojo y puede impedir o confundir el procesamiento.

Mitigacion temporal en limpiador v2.10: eliminar condiciones MPR invalidas `??="_..."` cuando la variable referida no existe.

Correccion preferente de origen: retirar o vaciar `<HomagExtraHBoreLine>` si WS Drill no requiere esa condicion.
