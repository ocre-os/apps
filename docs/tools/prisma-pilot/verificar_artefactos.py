#!/usr/bin/env python3
"""Comprueba integridad SHA-256 de archivos de un piloto PRISMA.

No prueba ceguera, independencia, autorización, validez clínica/técnica ni
que el archivo refleje una prueba real; sólo relaciona archivos y CSV.
"""
from __future__ import annotations
import argparse
import hashlib
import json
import re
from pathlib import Path
from evaluar import parse

HASH = re.compile(r"^[0-9a-f]{64}$")
CLASES = ("initial", "output")


def verificar(csv_path: Path, manifest_path: Path, root: Path) -> dict:
    corridas = parse(csv_path)
    root = Path(root).resolve(strict=True)
    if not root.is_dir():
        raise ValueError("La raíz debe ser un directorio")
    try:
        manifest = json.loads(Path(manifest_path).read_text(encoding="utf-8"))
    except (ValueError, UnicodeError) as e:
        raise ValueError("Manifiesto JSON no válido") from e
    if not isinstance(manifest, dict) or manifest.get("schema") != "prisma-pilot-artifacts-v1":
        raise ValueError("Versión de manifiesto no admitida")
    files = manifest.get("files")
    if not isinstance(files, list):
        raise ValueError("Se requiere una lista files")
    registrados = {clase: set() for clase in CLASES}
    rutas = set()
    for n, item in enumerate(files, 1):
        if not isinstance(item, dict):
            raise ValueError(f"Entrada de manifiesto #{n}: objeto requerido")
        kind, p, digest = item.get("kind"), item.get("path"), item.get("sha256")
        if kind not in CLASES or not isinstance(p, str) or not isinstance(digest, str):
            raise ValueError(f"Entrada de manifiesto #{n}: kind/path/sha256 inválidos")
        if not HASH.fullmatch(digest):
            raise ValueError(f"Entrada de manifiesto #{n}: SHA-256 debe ser hex minúsculo")
        rel = Path(p)
        if not p.strip() or rel.is_absolute() or ".." in rel.parts or rel == Path("."):
            raise ValueError(f"Entrada de manifiesto #{n}: ruta no permitida")
        dest = (root / rel).resolve(strict=True)
        if not dest.is_relative_to(root) or not dest.is_file():
            raise ValueError(f"Entrada de manifiesto #{n}: archivo fuera de la raíz")
        if str(dest) in rutas:
            raise ValueError(f"Entrada de manifiesto #{n}: archivo duplicado")
        rutas.add(str(dest))
        h = hashlib.sha256()
        with dest.open("rb") as source:
            for block in iter(lambda: source.read(1024 * 1024), b""):
                h.update(block)
        if h.hexdigest() != digest:
            raise ValueError(f"Entrada de manifiesto #{n}: hash no corresponde a {p}")
        registrados[kind].add(digest)
    checked = 0
    for case, methods in corridas.items():
        for method, row in methods.items():
            for kind, field in (("initial", "initial_sha256"), ("output", "output_sha256")):
                if row[field] not in registrados[kind]:
                    raise ValueError(f"{case}/{method}: {field} sin archivo verificado")
                checked += 1
    return {"status": "INTEGRIDAD_ARCHIVOS_OK", "cases_seen": len(corridas),
            "runs_seen": sum(len(v) for v in corridas.values()),
            "files_verified": len(rutas), "run_references_verified": checked,
            "field_effectiveness_proven": False}


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("corridas_csv", type=Path)
    ap.add_argument("manifest_json", type=Path)
    ap.add_argument("--root", type=Path, required=True)
    a = ap.parse_args()
    try:
        print(json.dumps(verificar(a.corridas_csv, a.manifest_json, a.root), ensure_ascii=False, indent=2))
    except (ValueError, OSError) as e:
        ap.exit(2, "Error de verificación: " + str(e) + "\n")


if __name__ == "__main__":
    main()