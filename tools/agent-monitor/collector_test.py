import unittest
import tempfile
from pathlib import Path
from unittest import mock
from collector import claude_state, codex_state, aggregate, codex_processes, read_codex
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

def fake_proc(names):
    directory=Path(tempfile.mkdtemp())
    for pid,name in names.items():
        (directory/str(pid)).mkdir()
        (directory/str(pid)/"comm").write_text(name+"\n")
    return directory

class CodexCliTests(unittest.TestCase):
    def test_inventory_lists_only_codex_processes(self):
        proc=fake_proc({10:"codex",11:"python3",12:"codex"})
        self.assertEqual(sorted(codex_processes(proc)),["10","12"])

    def test_no_codex_process_is_available(self):
        self.assertEqual(read_codex(Path(tempfile.mkdtemp()),fake_proc({11:"python3"})),"available")

    def test_unreadable_inventory_is_unknown(self):
        self.assertEqual(read_codex(Path(tempfile.mkdtemp()),Path("/nonexistent-proc")),"unknown")

    def test_live_process_without_recent_rollout_is_unknown(self):
        self.assertEqual(read_codex(Path(tempfile.mkdtemp()),fake_proc({10:"codex"})),"unknown")

    def test_live_process_with_running_turn_is_working(self):
        sessions=Path(tempfile.mkdtemp())
        rollout=sessions/"r.jsonl"
        rollout.write_text('{"type":"event_msg","payload":{"type":"task_started","turn_id":"a"}}\n')
        self.assertEqual(read_codex(sessions,fake_proc({10:"codex"})),"working")

    def test_stale_rollout_without_process_cannot_claim_working(self):
        sessions=Path(tempfile.mkdtemp())
        (sessions/"r.jsonl").write_text('{"type":"event_msg","payload":{"type":"task_started","turn_id":"a"}}\n')
        self.assertEqual(read_codex(sessions,fake_proc({})),"available")

if __name__=="__main__": unittest.main()
