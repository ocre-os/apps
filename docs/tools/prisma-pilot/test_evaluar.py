import csv
import io
import tempfile
import unittest
from pathlib import Path
from evaluar import parse, report

FIELDS = "case_id,method,run_id,operator_alias,order,active_minutes,claims_total,claims_supported,checks_total,checks_discriminant,reviewer_score_0_4,critical_errors,unsupported_certainty,ground_truth_available,reviewer_alias,reviewer_blinded,operator_prior_knowledge,initial_sha256,output_sha256,notes".split(",")
ZERO="0" * 64
ONE="1" * 64
TWO="2" * 64

def run(method="prisma", **overrides):
    row = dict(case_id="S01", method=method, run_id="r-"+method,
               operator_alias="op1" if method=="prisma" else "op2",
               order="1" if method=="prisma" else "2", active_minutes="15",
               claims_total="10", claims_supported="8", checks_total="4", checks_discriminant="3",
               reviewer_score_0_4="3", critical_errors="0", unsupported_certainty="1",
               ground_truth_available="yes", reviewer_alias="rev1", reviewer_blinded="yes",
               operator_prior_knowledge="no", initial_sha256=ZERO,
               output_sha256=ONE if method=="prisma" else TWO, notes="ficticio")
    row.update(overrides)
    return row

def load(rows):
    with tempfile.TemporaryDirectory() as tmp:
        path=Path(tmp)/"runs.csv"
        with path.open("w",encoding="utf-8",newline="") as f:
            w=csv.DictWriter(f,fieldnames=FIELDS)
            w.writeheader()
            w.writerows(rows)
        return parse(path)

class EvaluateTests(unittest.TestCase):
    def test_zero_real_runs(self):
        r=report(load([]))
        self.assertEqual(r["paired_cases"],0)
        self.assertEqual(r["measures"]["prisma"]["traceability_rate"],None)
        self.assertFalse(r["can_claim_superiority"])
    def test_paired_good(self):
        r=report(load([run(),run("ia")]))
        self.assertEqual(r["paired_cases"],1)
        self.assertEqual(r["measures"]["prisma"]["traceability_rate"],0.8)
        self.assertEqual(r["by_case"][0]["extra_prisma_minutes"],0)
    def test_incomplete_no_fake_pair(self):
        self.assertEqual(report(load([run()]))["incomplete_cases"],["S01"])
    def test_duplicate_order(self):
        with self.assertRaisesRegex(ValueError,"mismo orden"):
            load([run(),run("ia",order="1")])
    def test_mismatched_initials(self):
        with self.assertRaisesRegex(ValueError,"entradas iniciales"):
            load([run(),run("ia",initial_sha256=TWO)])
    def test_same_outputs(self):
        with self.assertRaisesRegex(ValueError,"mismo SHA-256"):
            load([run(),run("ia",output_sha256=ONE)])
    def test_same_reviewer_operator(self):
        with self.assertRaisesRegex(ValueError,"revisor independiente"):
            load([run(reviewer_alias="op1")])
    def test_invented_high_score(self):
        with self.assertRaisesRegex(ValueError,"desenlace conocido"):
            load([run(reviewer_score_0_4="4",ground_truth_available="no")])
    def test_beyond_counts(self):
        with self.assertRaisesRegex(ValueError,"exceden"):
            load([run(checks_discriminant="5")])
    def test_nonfinite_time(self):
        with self.assertRaisesRegex(ValueError,"finito"):
            load([run(active_minutes="NaN")])
    def test_nonblind_flag(self):
        r=report(load([run(reviewer_blinded="no"),run("ia")]))
        self.assertTrue(any("no ciega" in w for w in r["warnings"]))
    def test_prior_knowledge(self):
        r=report(load([run(operator_prior_knowledge="yes"),run("ia")]))
        self.assertTrue(any("conocía" in w for w in r["warnings"]))
    def test_critical_error(self):
        r=report(load([run(critical_errors="1"),run("ia")]))
        self.assertFalse(r["can_claim_superiority"])
        self.assertEqual(r["measures"]["prisma"]["critical_errors"],1)
    def test_no_claims_or_checks(self):
        r=report(load([run(claims_total="0",claims_supported="0",checks_total="0",checks_discriminant="0"),run("ia")]))
        self.assertIsNone(r["measures"]["prisma"]["traceability_rate"])
        self.assertIsNone(r["measures"]["prisma"]["discriminant_check_rate"])
    def test_wrong_sha(self):
        with self.assertRaisesRegex(ValueError,"SHA-256"):
            load([run(initial_sha256="abc")])
    def test_duplicate_method(self):
        with self.assertRaisesRegex(ValueError,"duplicado"):
            load([run(),run(run_id="r-alt")])
    def test_discordant_ground_truth(self):
        with self.assertRaisesRegex(ValueError,"discordancia"):
            load([run(),run("ia",ground_truth_available="no")])

if __name__=="__main__":
    unittest.main(verbosity=2)