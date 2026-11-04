import csv
import hashlib
import json
import tempfile
import unittest
from pathlib import Path
from test_evaluar import FIELDS, run
from verificar_artefactos import verificar


class IntegrityTests(unittest.TestCase):
    def setUp(self):
        self.t = tempfile.TemporaryDirectory()
        self.addCleanup(self.t.cleanup)
        self.root = Path(self.t.name)
        self.initial = self.root / "input.md"
        self.out_a = self.root / "salida-a.md"
        self.out_b = self.root / "salida-b.md"
        self.initial.write_text("mismo problema", encoding="utf8")
        self.out_a.write_text("síntesis prisma", encoding="utf8")
        self.out_b.write_text("respuesta IA", encoding="utf8")
        self.sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
        self.csv = self.root / "corridas.csv"
        with self.csv.open("w", newline="", encoding="utf8") as f:
            w=csv.DictWriter(f, fieldnames=FIELDS)
            w.writeheader()
            w.writerow(run(initial_sha256=self.sha(self.initial), output_sha256=self.sha(self.out_a)))
            w.writerow(run("ia", initial_sha256=self.sha(self.initial), output_sha256=self.sha(self.out_b)))
        self.manifest = self.root / "manifest.json"
        self.items = [dict(kind=k, path=p.name, sha256=self.sha(p)) for k, p in
                      (("initial", self.initial), ("output", self.out_a), ("output", self.out_b))]
        self.write_manifest()

    def write_manifest(self):
        self.manifest.write_text(json.dumps(dict(schema="prisma-pilot-artifacts-v1", files=self.items)), encoding="utf8")

    def test_ok_two_runs_four_refs(self):
        r = verificar(self.csv, self.manifest, self.root)
        self.assertEqual((r["files_verified"], r["run_references_verified"]), (3, 4))
        self.assertFalse(r["field_effectiveness_proven"])

    def test_tamper(self):
        self.out_a.write_text("alterado", encoding="utf8")
        with self.assertRaisesRegex(ValueError, "hash no corresponde"):
            verificar(self.csv, self.manifest, self.root)

    def test_missing_output(self):
        self.items.pop()
        self.write_manifest()
        with self.assertRaisesRegex(ValueError, "sin archivo verificado"):
            verificar(self.csv, self.manifest, self.root)

    def test_path_traversal(self):
        self.items[0]["path"] = "../outside.md"
        self.write_manifest()
        with self.assertRaisesRegex(ValueError, "ruta no permitida"):
            verificar(self.csv, self.manifest, self.root)

    def test_duplicate_file(self):
        self.items.append(self.items[0].copy())
        self.write_manifest()
        with self.assertRaisesRegex(ValueError, "archivo duplicado"):
            verificar(self.csv, self.manifest, self.root)

    def test_bad_hash(self):
        self.items[0]["sha256"] = "a"*64
        self.write_manifest()
        with self.assertRaisesRegex(ValueError, "hash no corresponde"):
            verificar(self.csv, self.manifest, self.root)

    def test_symlink_escape(self):
        with tempfile.TemporaryDirectory() as other:
            hidden = Path(other) / "other.txt"
            hidden.write_text("outside", encoding="utf8")
            alias = self.root / "alias.txt"
            alias.symlink_to(hidden)
            self.items.append(dict(kind="output", path=alias.name, sha256=self.sha(hidden)))
            self.write_manifest()
            with self.assertRaisesRegex(ValueError, "fuera de la raíz"):
                verificar(self.csv, self.manifest, self.root)

if __name__=="__main__":
    unittest.main(verbosity=2)