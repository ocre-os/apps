import unittest
import tempfile
from pathlib import Path
from unittest import mock
from collector import claude_state, codex_state, aggregate, codex_processes, read_codex
from collector import claude_turn_seconds, slots_by_provider, quota_view, collect_devenv
import json
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


NOW=1_800_000_000
class DevenvTests(unittest.TestCase):
    def sessions(self,*records):
        folder=tempfile.TemporaryDirectory();self.addCleanup(folder.cleanup)
        for index,record in enumerate(records):
            Path(folder.name,f"{index}.json").write_text(json.dumps(record))
        return Path(folder.name)
    def busy(self,seconds_ago,**extra):
        return {"pid":1,"procStart":"1","status":"busy","updatedAt":(NOW-seconds_ago)*1000,**extra}
    def test_claude_turn_is_the_longest_live_busy_session(self):
        directory=self.sessions(self.busy(90),self.busy(600),{"pid":2,"procStart":"2","status":"idle","updatedAt":(NOW-9999)*1000})
        with mock.patch("collector.process_alive",return_value=True):
            self.assertEqual(claude_turn_seconds(directory,NOW),600)
    def test_dead_or_idle_sessions_have_no_turn(self):
        directory=self.sessions(self.busy(90))
        with mock.patch("collector.process_alive",return_value=False):
            self.assertIsNone(claude_turn_seconds(directory,NOW))
        self.assertIsNone(claude_turn_seconds(Path("/definitely/missing"),NOW))
    def test_future_or_ancient_updates_are_not_trusted(self):
        directory=self.sessions(self.busy(-100),self.busy(8*86400))
        with mock.patch("collector.process_alive",return_value=True):
            self.assertIsNone(claude_turn_seconds(directory,NOW))
    def test_slots_count_the_effective_provider_and_cap_at_capacity(self):
        status={"reservations":[{"provider":"codex","effective_provider":"claude","task":"X"},
            {"provider":"codex"},{"provider":"codex","effective_provider":"codex"},{"provider":"claude","effective_provider":"claude"},
            {"provider":"claude","effective_provider":"claude"},{"provider":"other"}]}
        self.assertEqual(slots_by_provider(status),{"claude":2,"codex":2})
        self.assertEqual(slots_by_provider({"reservations":[]}),{"claude":0,"codex":0})
    def test_slots_unknown_when_status_is_unusable(self):
        for value in (None,{},{"reservations":"x"},[]):self.assertIsNone(slots_by_provider(value))
    def test_slots_output_carries_no_task_or_path(self):
        out=slots_by_provider({"reservations":[{"provider":"codex","task":"SECRET","root":"/home/x"}]})
        self.assertNotIn("SECRET",json.dumps(out));self.assertNotIn("/home",json.dumps(out))
    def quota(self,**data):
        base={"provider":"codex","complete":True,"blocked":False,"windows":[
            {"name":"primary","remaining":31,"resets_at":NOW+8000},{"name":"secondary","remaining":63,"resets_at":NOW+900000}]}
        return {"snapshot":{**base,**data}}
    def test_quota_takes_the_tightest_window(self):
        view=quota_view(self.quota(),NOW)
        self.assertEqual((view["state"],view["remaining_percent"]),("available",31))
        self.assertTrue(view["resets_at"].endswith("Z"))
    def test_quota_low_exhausted_and_unknown(self):
        low=quota_view(self.quota(windows=[{"name":"p","remaining":15,"resets_at":NOW+5}]),NOW)
        self.assertEqual(low["state"],"low")
        self.assertEqual(quota_view(self.quota(blocked=True),NOW)["state"],"exhausted")
        self.assertEqual(quota_view(self.quota(windows=[{"name":"p","remaining":0,"resets_at":NOW+5}]),NOW)["state"],"exhausted")
        for bad in (None,{},{"snapshot":{"complete":False,"windows":[]}},self.quota(complete=False)):
            self.assertEqual(quota_view(bad,NOW)["state"],"unknown")
    def test_collect_devenv_asks_for_quota_only_when_requested(self):
        calls=[]
        def runner(command,timeout):
            calls.append(command[1] if len(command)>1 else command[0])
            return {"reservations":[]} if command[1]=="status" else self.quota()
        directory=self.sessions()
        without=collect_devenv(directory,Path("/core/scripts"),False,runner,NOW)
        self.assertNotIn("codex_quota",without);self.assertEqual(without["slots"],{"claude":0,"codex":0})
        self.assertEqual(calls,["status"])
        with_quota=collect_devenv(directory,Path("/core/scripts"),True,runner,NOW)
        self.assertEqual(with_quota["codex_quota"]["remaining_percent"],31)
if __name__=="__main__": unittest.main()
