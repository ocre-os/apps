#!/usr/bin/env python3
"""PRISMA v0.5 pilot v1.1: non-causal descriptive paired evaluator.

Strictly validates CSV declarations; does not verify human judgments,
cryptographic source content, independent review or authorization itself.
No external dependencies, network calls or file writes.
"""
from __future__ import annotations
import argparse
import csv
import json
import math
import re
import sys
from collections import defaultdict
from pathlib import Path

METHODS = ("prisma", "ia")
COUNTS = ("claims_total", "claims_supported", "checks_total", "checks_discriminant",
          "reviewer_score_0_4", "critical_errors", "unsupported_certainty")
REQUIRED = ("case_id", "method", "run_id", "operator_alias", "order", "active_minutes",
            *COUNTS, "ground_truth_available", "reviewer_alias", "reviewer_blinded",
            "operator_prior_knowledge", "initial_sha256", "output_sha256")
SHA256 = re.compile(r"^[a-fA-F0-9]{64}$")


def fail(line, message):
    raise ValueError(f"Línea {line}: {message}")


def parse(path):
    try:
        with Path(path).open(newline="", encoding="utf-8-sig") as f:
            reader = csv.DictReader(f)
            if not reader.fieldnames:
                raise ValueError("Faltan encabezados de corridas")
            if len(set(reader.fieldnames)) != len(reader.fieldnames):
                raise ValueError("Encabezados duplicados")
            missing = set(REQUIRED) - set(reader.fieldnames)
            if missing:
                raise ValueError("Columnas faltantes: " + ", ".join(sorted(missing)))
            rows = list(reader)
    except UnicodeError as e:
        raise ValueError("Archivo no UTF-8") from e

    pairs = defaultdict(dict)
    used_run_ids = set()
    for line, row in enumerate(rows, 2):
        if None in row or any(v is None for v in row.values()):
            fail(line, "cantidad de columnas irregular")
        case = row["case_id"].strip()
        method = row["method"].strip().lower()
        if not case or not re.fullmatch(r"[A-Za-z][A-Za-z0-9_-]{1,31}", case):
            fail(line, "identificador de análisis inválido")
        if method not in METHODS:
            fail(line, "método debe ser prisma o ia")
        run = row["run_id"].strip()
        if not run or run in used_run_ids:
            fail(line, "run_id vacío o duplicado")
        if method in pairs[case]:
            fail(line, f"método {method} duplicado para {case}")
        used_run_ids.add(run)
        for field in ("operator_alias", "reviewer_alias"):
            row[field] = row[field].strip()
            if not row[field]:
                fail(line, f"{field} vacío")
        if row["operator_alias"].casefold() == row["reviewer_alias"].casefold():
            fail(line, "el operador no puede actuar como revisor independiente")
        for field in COUNTS:
            raw = row[field].strip()
            if not raw.isdecimal():
                fail(line, f"{field}: entero >= 0 requerido")
            row[field] = int(raw)
        if row["claims_supported"] > row["claims_total"]:
            fail(line, "afirmaciones sustentadas exceden afirmaciones totales")
        if row["checks_discriminant"] > row["checks_total"]:
            fail(line, "comprobaciones discriminantes exceden comprobaciones totales")
        if row["reviewer_score_0_4"] > 4:
            fail(line, "calidad fuera de 0–4")
        raw_time = row["active_minutes"].strip()
        try:
            minutes = float(raw_time)
        except ValueError as e:
            raise ValueError(f"Línea {line}: tiempo numérico requerido") from e
        if not math.isfinite(minutes) or minutes <= 0:
            fail(line, "tiempo activo finito > 0 requerido")
        row["active_minutes"] = minutes
        if row["order"].strip() not in ("1", "2"):
            fail(line, "order debe ser 1 o 2")
        row["order"] = int(row["order"].strip())
        for field in ("ground_truth_available", "reviewer_blinded", "operator_prior_knowledge"):
            row[field] = row[field].strip().lower()
            if row[field] not in ("yes", "no"):
                fail(line, f"{field} debe ser yes/no")
        if row["reviewer_score_0_4"] == 4 and row["ground_truth_available"] != "yes":
            fail(line, "puntuación 4 requiere desenlace conocido")
        for field in ("initial_sha256", "output_sha256"):
            row[field] = row[field].strip().lower()
            if not SHA256.fullmatch(row[field]):
                fail(line, f"{field} no es SHA-256 hexadecimal válido")
        pairs[case][method] = row
    for case, methods in pairs.items():
        if set(methods) == set(METHODS):
            p, a = methods["prisma"], methods["ia"]
            if p["order"] == a["order"]:
                raise ValueError(f"Caso {case}: ambos métodos tienen el mismo orden")
            if p["initial_sha256"] != a["initial_sha256"]:
                raise ValueError(f"Caso {case}: las entradas iniciales no coinciden")
            if p["output_sha256"] == a["output_sha256"]:
                raise ValueError(f"Caso {case}: las salidas congeladas tienen el mismo SHA-256")
            if p["ground_truth_available"] != a["ground_truth_available"]:
                raise ValueError(f"Caso {case}: discordancia de disponibilidad de desenlace")
    return pairs


def rate(num, den):
    return None if den == 0 else round(num / den, 4)


def report(pairs):
    paired = {c: m for c, m in pairs.items() if set(m) == set(METHODS)}
    incomplete = sorted(set(pairs) - set(paired))
    issues = []
    if not pairs:
        issues.append("No existen corridas de campo: 0 resultados comparativos")
    if incomplete:
        issues.append("Hay análisis sin par de métodos: " + ", ".join(incomplete))
    if len(paired) < 3:
        issues.append("Menos de tres pares completos: piloto sin ejecutar totalmente")
    for case, methods in sorted(paired.items()):
        p, a = methods["prisma"], methods["ia"]
        if p["operator_alias"] == a["operator_alias"]:
            issues.append(f"{case}: mismo operador en ambas condiciones; posible arrastre de memoria")
        for method in METHODS:
            row = methods[method]
            if row["reviewer_blinded"] == "no":
                issues.append(f"{case}/{method}: evaluación no ciega")
            if row["operator_prior_knowledge"] == "yes":
                issues.append(f"{case}/{method}: operador conocía el desenlace")
            if row["ground_truth_available"] == "no":
                issues.append(f"{case}/{method}: sin desenlace confirmado")
            if row["critical_errors"]:
                issues.append(f"{case}/{method}: {row['critical_errors']} errores críticos")
            if row["claims_total"] == 0:
                issues.append(f"{case}/{method}: tasa de trazabilidad no evaluable (0 afirmaciones)")
            if row["checks_total"] == 0:
                issues.append(f"{case}/{method}: capacidad discriminante no evaluable (0 comprobaciones)")
    result = {"status": "PILOTO_EXPLORATORIO_NO_CAUSAL", "cases_seen": len(pairs),
              "paired_cases": len(paired), "incomplete_cases": incomplete,
              "measures": {}, "by_case": [], "warnings": issues,
              "limits": ["Los recuentos son juicios humanos que requieren soportes externos; el programa sólo valida su formato y coherencia.",
                         "Los SHA-256 declarados no se comprueban contra ficheros originales: conservar manifiesto y artefactos.",
                         "La revisión ciega y la autorización se declaran pero no pueden verificarse mediante este CSV.",
                         "Con n=3 sólo se obtendrán observaciones exploratorias; no demostrar superioridad."]}
    for method in METHODS:
        rows = [m[method] for m in paired.values()]
        claims = sum(r["claims_total"] for r in rows)
        checks = sum(r["checks_total"] for r in rows)
        result["measures"][method] = {
            "runs": len(rows),
            "total_minutes": round(sum(r["active_minutes"] for r in rows), 2),
            "supported_claims": sum(r["claims_supported"] for r in rows),
            "total_claims": claims,
            "traceability_rate": rate(sum(r["claims_supported"] for r in rows), claims),
            "discriminant_check_rate": rate(sum(r["checks_discriminant"] for r in rows), checks),
            "mean_review_score": round(sum(r["reviewer_score_0_4"] for r in rows) / len(rows), 2) if rows else None,
            "critical_errors": sum(r["critical_errors"] for r in rows),
            "unsupported_certainty": sum(r["unsupported_certainty"] for r in rows)
        }
    for case, methods in sorted(paired.items()):
        p, a = methods["prisma"], methods["ia"]
        result["by_case"].append({
            "case_id": case,
            "prisma_minutes": p["active_minutes"],
            "ia_minutes": a["active_minutes"],
            "extra_prisma_minutes": round(p["active_minutes"] - a["active_minutes"], 2),
            "prisma_traceability": rate(p["claims_supported"], p["claims_total"]),
            "ia_traceability": rate(a["claims_supported"], a["claims_total"]),
            "prisma_critical_errors": p["critical_errors"],
            "ia_critical_errors": a["critical_errors"],
            "ground_truth_available": p["ground_truth_available"] == "yes"
        })
    result["can_claim_superiority"] = False
    return result


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("corridas_csv", type=Path)
    args = p.parse_args()
    try:
        result = report(parse(args.corridas_csv))
    except (OSError, ValueError) as e:
        sys.exit("Error de validación: " + str(e))
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()