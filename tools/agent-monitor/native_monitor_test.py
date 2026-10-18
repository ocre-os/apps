import unittest
import json
import sqlite3
from native_monitor import runtime_state, inspect_projection, build_request, USER_AGENT, combine_states, parse_start_times
class NativeStateTests(unittest.TestCase):
    def test_running_turn_is_working(self):
        self.assertEqual(runtime_state(["inProgress"],[],True),"working")
    def test_approval_is_waiting(self):
        self.assertEqual(runtime_state(["inProgress"],["approval"],True),"waiting")
    def test_background_command_keeps_working(self):
        self.assertEqual(runtime_state(["completed"],["command"],True),"working")
    def test_idle_app_is_waiting(self):
        self.assertEqual(runtime_state(["completed"],[],True),"waiting")
    def test_missing_app_is_available(self):
        self.assertEqual(runtime_state(["completed"],[],False),"available")
    def test_unknown_projection_is_unknown(self):
        self.assertEqual(runtime_state(["newState"],[],True),"unknown")

    def test_empty_projection_not_waiting(self):
        self.assertEqual(runtime_state([],[],True),"unknown")
    def test_multiple_work_has_priority_over_one_approval(self):
        self.assertEqual(runtime_state(["inProgress","inProgress"],["approval"],True),"working")

NOW=1_000_000

def projection(turns,items):
    db=sqlite3.connect(":memory:")
    db.execute("CREATE TABLE thread_turns(thread_id,turn_id,status,started_at,completed_at,rollout_ordinal)")
    db.execute("""CREATE TABLE thread_items(thread_id,turn_id,item_type,item_json,
                  created_at_ms,started_at_ms,completed_at_ms)""")
    for t in turns:db.execute("INSERT INTO thread_turns VALUES('c',?,?,?,?,?)",t)
    for turn,kind,value in items:
        db.execute("INSERT INTO thread_items VALUES('c',?,?,?,?,?,?)",
                   (turn,kind,json.dumps(value),NOW*1000,NOW*1000,NOW*1000))
    return db

class ProjectionTests(unittest.TestCase):
    TURNS=[("A","completed",NOW-5,NOW-4,1),("B","completed",NOW-2,NOW-1,2)]

    def state(self,items,turns=None):
        return inspect_projection(projection(turns or self.TURNS,items),NOW)

    def test_pending_process_in_earlier_turn_is_not_waiting(self):
        items=[("A","commandExecution",{"status":"completed","processId":"7","exitCode":None})]
        self.assertEqual(self.state(items),"unknown")

    def test_inprogress_command_in_earlier_turn_is_not_waiting(self):
        items=[("A","commandExecution",{"status":"inProgress"})]
        self.assertEqual(self.state(items),"unknown")

    def test_closed_process_in_earlier_turn_is_waiting(self):
        items=[("A","commandExecution",{"status":"completed","processId":"7","exitCode":0})]
        self.assertEqual(self.state(items),"waiting")

    def test_file_change_in_progress_is_unknown(self):
        items=[("B","fileChange",{"status":"inProgress"})]
        self.assertEqual(self.state(items),"unknown")

    def test_future_item_type_in_progress_is_unknown(self):
        items=[("B","somethingNew",{"status":"running"})]
        self.assertEqual(self.state(items),"unknown")

    def test_completed_future_item_type_is_waiting(self):
        items=[("B","somethingNew",{"status":"completed"})]
        self.assertEqual(self.state(items),"waiting")

    def test_inprogress_command_in_latest_turn_is_working(self):
        items=[("B","commandExecution",{"status":"inProgress"})]
        self.assertEqual(self.state(items),"working")

class IdleEngineTests(unittest.TestCase):
    """A live engine process is positive evidence about which persisted records are dead."""
    ENGINE=NOW-500

    def state(self,turns,items=(),engine=ENGINE,now=NOW):
        return inspect_projection(projection(turns,list(items)),now,engine)

    def test_old_resolved_history_under_live_engine_is_available(self):
        # The app-server stays alive for days; idle history is not a session.
        self.assertEqual(self.state([("A","completed",NOW-100,NOW-90,1)]),"available")
        self.assertEqual(self.state([("A","failed",NOW-100,NOW-90,1)]),"available")

    def test_just_finished_turn_still_waits(self):
        self.assertEqual(self.state([("A","completed",NOW-20,NOW-10,1)]),"waiting")

    def timed(self,turns,items):
        """items: (turn, kind, value, activity_epoch_seconds)."""
        db=projection(turns,[])
        for turn,kind,value,when in items:
            db.execute("INSERT INTO thread_items VALUES('c',?,?,?,?,?,?)",
                       (turn,kind,json.dumps(value),when*1000,when*1000,when*1000))
        return db

    def test_orphan_inprogress_turn_from_before_the_engine_is_available(self):
        db=self.timed([("A","inProgress",self.ENGINE-5000,None,1)],[("A","userMessage",{},self.ENGINE-5000)])
        self.assertEqual(inspect_projection(db,NOW,self.ENGINE),"available")

    def test_orphan_inprogress_command_from_before_the_engine_is_ignored(self):
        turns=[("A","completed",self.ENGINE-100,self.ENGINE-90,1),("B","completed",NOW-100,NOW-90,2)]
        db=self.timed(turns,[("A","commandExecution",{"status":"inProgress"},self.ENGINE-95)])
        self.assertEqual(inspect_projection(db,NOW,self.ENGINE),"available")

    def test_same_command_after_the_engine_started_is_still_uncertain(self):
        turns=[("A","completed",self.ENGINE+10,self.ENGINE+20,1),("B","completed",NOW-100,NOW-90,2)]
        db=self.timed(turns,[("A","commandExecution",{"status":"inProgress"},self.ENGINE+15)])
        self.assertEqual(inspect_projection(db,NOW,self.ENGINE),"unknown")

    def test_inprogress_turn_started_under_this_engine_but_silent_is_unknown(self):
        db=self.timed([("A","inProgress",NOW-200,None,1)],[("A","userMessage",{},NOW-200)])
        self.assertEqual(inspect_projection(db,NOW,self.ENGINE),"unknown")

    def test_live_unresolved_item_under_this_engine_is_unknown(self):
        turns=[("A","completed",NOW-100,NOW-90,1)]
        db=self.timed(turns,[("A","commandExecution",{"status":"completed","processId":"7","exitCode":None},NOW-95)])
        self.assertEqual(inspect_projection(db,NOW,self.ENGINE),"unknown")

    def test_future_dated_history_is_never_available(self):
        self.assertEqual(self.state([("A","completed",NOW+500,NOW+510,1)]),"unknown")

    def test_without_engine_evidence_old_history_stays_unknown(self):
        self.assertEqual(self.state([("A","completed",NOW-100,NOW-90,1)],engine=None),"unknown")

    def test_no_threads_is_unknown(self):
        self.assertEqual(self.state([]),"unknown")

class CombineTests(unittest.TestCase):
    def test_work_in_either_source_wins(self):
        self.assertEqual(combine_states(["available","working"]),"working")
        self.assertEqual(combine_states(["unknown","working"]),"working")

    def test_any_unknown_source_blocks_available(self):
        self.assertEqual(combine_states(["available","unknown"]),"unknown")

    def test_both_idle_is_available_and_waiting_beats_available(self):
        self.assertEqual(combine_states(["available","available"]),"available")
        self.assertEqual(combine_states(["available","waiting"]),"waiting")

    def test_no_sources_is_unknown(self):
        self.assertEqual(combine_states([]),"unknown")

class StartTimeTests(unittest.TestCase):
    def test_parses_epoch_lines_and_ignores_noise(self):
        self.assertEqual(parse_start_times("1791946099\r\n1792227436\r\n"),[1791946099,1792227436])
        self.assertEqual(parse_start_times("error: acceso denegado"),[])

class RequestTests(unittest.TestCase):
    def test_request_names_the_client_and_carries_token(self):
        req=build_request("https://staging.ocre.mx/api/agents",b"{}","secret")
        self.assertEqual(req.get_header("User-agent"),USER_AGENT)
        self.assertEqual(req.get_header("Authorization"),"Bearer secret")
        self.assertEqual(req.get_method(),"POST")

if __name__=="__main__":unittest.main()
