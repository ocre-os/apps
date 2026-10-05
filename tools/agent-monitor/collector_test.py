import unittest
from collector import claude_state, codex_state, aggregate
class ActivityTests(unittest.TestCase):
    def test_claude_idle_is_waiting_not_busy(self):
        self.assertEqual(claude_state({"status":"idle"}, True), "waiting")
    def test_claude_busy_is_working(self):
        self.assertEqual(claude_state({"status":"busy"}, True), "working")
    def test_unknown_status_is_not_available(self):
        self.assertEqual(claude_state({"status":"novel"}, True), "unknown")
    def test_dead_session_not_working(self):
        self.assertEqual(claude_state({"status":"busy"}, False), "available")
    def test_task_started_is_working(self):
        self.assertEqual(codex_state([{"type":"task_started","turn_id":"a"}], True, True), "working")
    def test_complete_with_unverified_background_is_unknown(self):
        self.assertEqual(codex_state([{"type":"task_complete","turn_id":"a"}], True, False), "unknown")
    def test_completed_verified_session_waits(self):
        self.assertEqual(codex_state([{"type":"task_started","turn_id":"a"},{"type":"task_complete","turn_id":"a"}], True, True), "waiting")
    def test_other_turn_remains_working(self):
        self.assertEqual(codex_state([{"type":"task_started","turn_id":"a"},{"type":"task_started","turn_id":"b"},{"type":"task_complete","turn_id":"a"}], True, True), "working")
    def test_no_source_is_unknown(self):
        self.assertEqual(codex_state([], True, True), "unknown")
    def test_incomplete_source_cannot_claim_available(self):
        self.assertEqual(aggregate(["available"], False), "unknown")
    def test_working_takes_priority(self):
        self.assertEqual(aggregate(["working","unknown"], False), "working")
if __name__=="__main__": unittest.main()
