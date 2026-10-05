import unittest
import json
import sqlite3
from native_monitor import runtime_state, inspect_projection, build_request, USER_AGENT
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

class RequestTests(unittest.TestCase):
    def test_request_names_the_client_and_carries_token(self):
        req=build_request("https://staging.ocre.mx/api/agents",b"{}","secret")
        self.assertEqual(req.get_header("User-agent"),USER_AGENT)
        self.assertEqual(req.get_header("Authorization"),"Bearer secret")
        self.assertEqual(req.get_method(),"POST")

if __name__=="__main__":unittest.main()
