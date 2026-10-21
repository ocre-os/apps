import unittest
import tempfile
from pathlib import Path
from unittest import mock
from collector import claude_state, codex_state, aggregate, codex_processes, read_codex
from collector import claude_turn_seconds, slots_by_provider, quota_view, collect_devenv, read_events, read_validations, read_supervisor
import json
import os
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
    def test_commands_run_inside_the_core_checkout_not_the_inherited_directory(self):
        seen=[]
        def runner(command,timeout,cwd=None):
            seen.append(cwd);return {"reservations":[]} if command[1]=="status" else self.quota()
        collect_devenv(self.sessions(),Path("/core/scripts"),True,runner,NOW)
        self.assertEqual(seen,[Path("/core"),Path("/core")])
    def test_collect_devenv_asks_for_quota_only_when_requested(self):
        calls=[]
        def runner(command,timeout,cwd=None):
            self.assertEqual(cwd,Path("/core"))
            calls.append(command[1] if len(command)>1 else command[0])
            return {"reservations":[]} if command[1]=="status" else self.quota()
        directory=self.sessions()
        without=collect_devenv(directory,Path("/core/scripts"),False,runner,NOW)
        self.assertNotIn("codex_quota",without);self.assertEqual(without["slots"],{"claude":0,"codex":0})
        self.assertEqual(calls,["status"])
        with_quota=collect_devenv(directory,Path("/core/scripts"),True,runner,NOW)
        self.assertEqual(with_quota["codex_quota"]["remaining_percent"],31)

class EventsTests(unittest.TestCase):
    def log(self,*lines):
        folder=tempfile.TemporaryDirectory();self.addCleanup(folder.cleanup)
        path=Path(folder.name,"events.jsonl");path.write_text("\n".join(lines)+"\n");return path
    def line(self,kind="deploy_ok",at="2026-10-18T12:00:00Z",ref="3d84e77a1b2c",**extra):
        return json.dumps({"at":at,"kind":kind,"ref":ref,**extra})
    def test_events_are_newest_first_and_capped(self):
        lines=[self.line(at=f"2026-10-18T12:0{i}:00Z") for i in range(8)]
        out=read_events(self.log(*lines))
        self.assertEqual(len(out),5);self.assertEqual(out[0]["at"],"2026-10-18T12:07:00Z")
    def test_invalid_lines_are_dropped_not_repaired(self):
        out=read_events(self.log("no es json",self.line(kind="deploy_started"),self.line(ref="main"),self.line(ref="9fab2c1; rm -rf /"),
            self.line(at="ayer"),'[1,2]',self.line(kind="monitor_stale",ref=None)))
        self.assertEqual([e["kind"] for e in out],["monitor_stale"])
    def test_extra_fields_never_pass_through(self):
        out=read_events(self.log(self.line(secret="x",path="/home/ocre")))
        self.assertEqual(set(out[0]),{"at","kind","ref"})
    def test_missing_file_means_no_events(self):
        self.assertEqual(read_events(Path("/definitely/missing.jsonl")),[])
    def test_collect_devenv_includes_the_events(self):
        path=self.log(self.line())
        def runner(command,timeout,cwd=None):return {"reservations":[]}
        result=collect_devenv(Path("/definitely/missing"),Path("/core/scripts"),False,runner,NOW,events_path=path)
        self.assertEqual(result["events"][0]["kind"],"deploy_ok")

class ValidationReadTests(unittest.TestCase):
    def test_reads_newest_first_and_revalidates_every_line(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "v.jsonl"
            lines = [
                {"at": "2026-10-18T10:00:00Z", "sha": "0c43fcc", "result": "fail"},
                {"at": "2026-10-18T12:00:00Z", "sha": "6a3aaf9f35ae", "result": "pass"},
                {"at": "2026-10-18T11:00:00Z", "sha": "main", "result": "pass"},
                {"at": "ayer", "sha": "6a3aaf9", "result": "pass"},
                {"at": "2026-10-18T09:00:00Z", "sha": "6a3aaf9", "result": "ok"},
                {"at": "2026-10-18T08:00:00Z", "sha": "abc1234", "result": "pass", "log": "/home/ocre/x"},
            ]
            path.write_text("\n".join(json.dumps(x) for x in lines) + "\nno es json\n")
            result = read_validations(path)
            self.assertEqual([v["sha"] for v in result], ["6a3aaf9f35ae", "0c43fcc", "abc1234"])
            self.assertTrue(all(set(v) == {"at", "sha", "result"} for v in result))

    def test_missing_file_is_empty_and_never_success(self):
        self.assertEqual(read_validations(Path("/no/existe.jsonl")), [])

class SupervisorReadTests(unittest.TestCase):
    GOOD = {"at": "2026-10-18T12:00:00Z", "phase": "F0", "mode": "observe", "stopped": False, "valid": 6, "rejected": 4, "launched": 0}

    def read(self, value):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "s.json"
            path.write_text(value if isinstance(value, str) else json.dumps(value))
            return read_supervisor(path)

    def test_valid_summary_passes_unchanged(self):
        self.assertEqual(self.read(self.GOOD), self.GOOD)

    def test_extra_missing_mistyped_or_out_of_range_fields_are_refused(self):
        for bad in ({**self.GOOD, "task": "OCRE-TASK-9"}, {k: v for k, v in self.GOOD.items() if k != "valid"},
                    {**self.GOOD, "valid": -1}, {**self.GOOD, "valid": 1000}, {**self.GOOD, "valid": True},
                    {**self.GOOD, "stopped": "no"}, {**self.GOOD, "phase": "F9"}, {**self.GOOD, "mode": "turbo"},
                    {**self.GOOD, "at": "ayer"}, "no es json", "[]"):
            self.assertIsNone(self.read(bad))

    def test_missing_file_is_none_never_success(self):
        self.assertIsNone(read_supervisor(Path("/no/existe.json")))


if __name__=="__main__": unittest.main()


class RemoteClaudeTests(unittest.TestCase):
    NOW=1_800_000_000.0

    def history(self, directory, offset_s):
        path=Path(directory)/"claude_tool_call.log"
        path.write_text("contenido que no se lee")
        os.utime(path,(self.NOW-offset_s,self.NOW-offset_s))
        return path

    def run_record(self, directory, status, pid, updated_offset_s=7200):
        import datetime as dt
        updated=dt.datetime.fromtimestamp(self.NOW-updated_offset_s,dt.timezone.utc).isoformat()
        path=Path(directory)/"full.json"
        path.write_text(json.dumps({"status":status,"pid":pid,"updated_at":updated}))
        return Path(directory)

    def test_recent_desktop_commander_call_means_working(self):
        from collector import remote_claude_working
        with tempfile.TemporaryDirectory() as d:
            history=self.history(d,30)
            self.assertTrue(remote_claude_working(self.NOW,history,Path(d)/"sin-corridas",lambda pid:False))

    def test_old_call_without_live_run_is_not_a_signal(self):
        from collector import remote_claude_working
        with tempfile.TemporaryDirectory() as d:
            history=self.history(d,600)
            self.assertFalse(remote_claude_working(self.NOW,history,Path(d)/"sin-corridas",lambda pid:False))

    def test_live_bounded_run_means_working_even_when_calls_are_old(self):
        from collector import remote_claude_working
        with tempfile.TemporaryDirectory() as d:
            history=self.history(d,3600)
            runs=self.run_record(d,"running",123)
            self.assertTrue(remote_claude_working(self.NOW,history,runs,lambda pid:pid==123))

    def test_dead_or_finished_runs_do_not_count(self):
        from collector import remote_claude_working
        with tempfile.TemporaryDirectory() as d:
            history=self.history(d,3600)
            self.assertFalse(remote_claude_working(self.NOW,history,self.run_record(d,"running",123),lambda pid:False))
            self.assertFalse(remote_claude_working(self.NOW,history,self.run_record(d,"passed",123),lambda pid:True))

    def test_missing_history_is_not_a_signal_and_never_raises(self):
        from collector import remote_claude_working
        with tempfile.TemporaryDirectory() as d:
            self.assertFalse(remote_claude_working(self.NOW,Path(d)/"no-existe.jsonl",Path(d)/"sin-corridas",lambda pid:False))

    def test_signal_only_upgrades_to_working(self):
        from collector import claude_with_remote
        self.assertEqual(claude_with_remote("available",True),"working")
        self.assertEqual(claude_with_remote("waiting",False),"waiting")
        self.assertEqual(claude_with_remote("unknown",False),"unknown")

    def test_run_finished_minutes_ago_still_counts_but_not_hours_later(self):
        from collector import remote_claude_working
        with tempfile.TemporaryDirectory() as d:
            history=self.history(d,3600)
            self.assertTrue(remote_claude_working(self.NOW,history,self.run_record(d,"passed",1,updated_offset_s=240),lambda pid:False))
            self.assertFalse(remote_claude_working(self.NOW,history,self.run_record(d,"passed",1,updated_offset_s=7200),lambda pid:False))
