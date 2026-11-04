#!/usr/bin/env python3
"""Verifica integridad de enunciados/desenlaces y la separación de los ZIP.

No verifica elegibilidad de casos, ceguera humana, ausencia de sesgos ni eficacia.
"""
from __future__ import annotations
import argparse
import hashlib
import json
import re
import stat
import sys
import zipfile
from pathlib import Path

SCHEMA = 'prisma-pilot-source-files-v1'
ROLES = {'investigador': 'enunciado', 'revisor': 'desenlace'}
HASH = re.compile(r'[0-9a-f]{64}\Z')
NAME = re.compile(r'([A-Z][0-9]{2})-(enunciado|desenlace)\.md\Z')


def validate(manifest: Path, root: Path, investigador_zip: Path | None = None,
             revisor_zip: Path | None = None) -> dict:
    root = Path(root).resolve(strict=True)
    if not root.is_dir():
        raise ValueError('La raíz no es un directorio')
    try:
        data = json.loads(Path(manifest).read_text(encoding='utf-8'))
    except (ValueError, UnicodeError) as e:
        raise ValueError('JSON de manifiesto inválido') from e
    if not isinstance(data, dict) or data.get('schema') != SCHEMA:
        raise ValueError('Esquema de manifiesto no admitido')
    entries = data.get('files')
    if not isinstance(entries, list) or not entries:
        raise ValueError('El manifiesto requiere archivos')
    seen = set()
    by_role = {role: {} for role in ROLES}
    for pos, item in enumerate(entries, 1):
        if not isinstance(item, dict):
            raise ValueError(f'Entrada {pos}: objeto requerido')
        path, role, h = item.get('path'), item.get('role'), item.get('sha256')
        if role not in ROLES or not isinstance(path, str) or not isinstance(h, str):
            raise ValueError(f'Entrada {pos}: role/path/sha256 inválidos')
        if not HASH.fullmatch(h):
            raise ValueError(f'Entrada {pos}: SHA-256 hexadecimal minúsculo requerido')
        if '\\' in path or '\x00' in path:
            raise ValueError(f'Entrada {pos}: separadores o caracteres prohibidos')
        rel = Path(path)
        if rel.is_absolute() or '..' in rel.parts or len(rel.parts) != 2 or rel.parts[0] != role:
            raise ValueError(f'Entrada {pos}: ruta insegura o rol incompatible')
        m = NAME.fullmatch(rel.name)
        if not m or m[2] != ROLES[role]:
            raise ValueError(f'Entrada {pos}: nombre no corresponde al rol')
        if path in seen or (role, m[1]) in seen:
            raise ValueError(f'Entrada {pos}: archivo o caso duplicado')
        seen.add(path); seen.add((role, m[1]))
        file = (root / rel).resolve(strict=True)
        if not file.is_relative_to(root) or not file.is_file():
            raise ValueError(f'Entrada {pos}: archivo inexistente o fuera de raíz')
        payload = file.read_bytes()
        if hashlib.sha256(payload).hexdigest() != h:
            raise ValueError(f'Entrada {pos}: SHA-256 no coincide con {path}')
        by_role[role][m[1]] = (rel.name, payload)
    cases = sorted(by_role['investigador'])
    if not cases or cases != sorted(by_role['revisor']):
        raise ValueError('Cada análisis requiere enunciado y desenlace separados')
    zips = {'investigador': investigador_zip, 'revisor': revisor_zip}
    if any(p is not None for p in zips.values()) and not all(p is not None for p in zips.values()):
        raise ValueError('Entregar ambos ZIP para comprobar separación')
    for role, path in zips.items():
        if path is None:
            continue
        try:
            with zipfile.ZipFile(path) as z:
                info = z.infolist()
                names = [x.filename for x in info]
                expected = {x[0] for x in by_role[role].values()}
                if len(names) != len(expected) or set(names) != expected:
                    raise ValueError(f'ZIP {role}: faltan expedientes o contiene archivos ajenos al rol')
                for x in info:
                    if x.is_dir() or stat.S_ISLNK(x.external_attr >> 16):
                        raise ValueError(f'ZIP {role}: entrada de tipo prohibido')
                    case = NAME.fullmatch(x.filename)[1]
                    if z.read(x) != by_role[role][case][1]:
                        raise ValueError(f'ZIP {role}: contenido no corresponde al manifiesto')
        except (zipfile.BadZipFile, RuntimeError) as e:
            raise ValueError(f'ZIP {role}: archivo inválido') from e
    return {'status': 'FUENTES_Y_ROLES_VERIFICADOS', 'cases': cases,
            'files_verified': len(entries), 'role_zip_separation_verified': all(zips.values()),
            'real_runs_evaluated': 0, 'human_blinding_verified': False,
            'eligibility_verified': False, 'superiority_demonstrated': False}


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--root', type=Path, required=True)
    p.add_argument('--manifest', type=Path, required=True)
    p.add_argument('--investigador', type=Path)
    p.add_argument('--revisor', type=Path)
    args = p.parse_args()
    try:
        print(json.dumps(validate(args.manifest, args.root, args.investigador,
                                  args.revisor), ensure_ascii=False, indent=2))
    except (OSError, ValueError, KeyError) as e:
        p.exit(2, 'Fallo de integridad o segregación: ' + str(e) + '\n')


if __name__ == '__main__':
    main()
