import json
import os
from pathlib import Path
import sqlite3
import tempfile
import time
import unittest
from collector import read_claude
from native_monitor import inspect_projection

class SourceTests(unittest.TestCase):
    def database(self):
        db=sqlite3.connect(":memory:")
        db.executescript("""
          CREATE TABLE thread_turns(thread_id TEXT,turn_id TEXT,status TEXT,started_at REAL,completed_at REAL,rollout_ordinal INT);
          CREATE TABLE thread_items(thread_id TEXT,turn_id TEXT,item_type TEXT,item_json TEXT,created_at_ms REAL,started_at_ms REAL,completed_at_ms REAL);
        """)
        self.addCleanup(db.close)
        return db
    def test_empty_real_database_is_unknown(self):
        self.assertEqual(inspect_projection(self.database(),1000),"unknown")
    def test_stale_inprogress_projection_is_unknown(self):
        db=self.database()
        db.execute("INSERT INTO thread_turns VALUES('a','t','inProgress',900,NULL,1)")
        self.assertEqual(inspect_projection(db,1000),"unknown")
    def test_completed_background_process_cannot_claim_waiting(self):
        db=self.database()
        db.execute("INSERT INTO thread_turns VALUES('a','t','completed',990,995,1)")
        db.execute("INSERT INTO thread_items VALUES('a','t','commandExecution',?,995000,995000,995000)",
                   (json.dumps({"status":"completed","processId":"42","exitCode":None}),))
        self.assertEqual(inspect_projection(db,1000),"unknown")
    def test_other_active_chat_keeps_working_during_approval(self):
        db=self.database()
        db.execute("INSERT INTO thread_turns VALUES('a','x','inProgress',990,NULL,1)")
        db.execute("INSERT INTO thread_turns VALUES('b','y','inProgress',990,NULL,1)")
        db.execute("INSERT INTO thread_items VALUES('a','x','requestUserInput',?,990000,990000,NULL)",
                   (json.dumps({"status":"inProgress"}),))
        self.assertEqual(inspect_projection(db,1000),"working")
    def test_stale_live_claude_record_is_unknown(self):
        with tempfile.TemporaryDirectory() as tmp:
            identity=Path(f"/proc/{os.getpid()}/stat").read_text().rsplit(")",1)[1].split()[19]
            Path(tmp,"session.json").write_text(json.dumps({
                "pid":os.getpid(),"procStart":identity,"status":"idle","updatedAt":int((time.time()-60)*1000)}))
            self.assertEqual(read_claude(Path(tmp)),"unknown")
    def test_missing_process_identity_is_unknown(self):
        with tempfile.TemporaryDirectory() as tmp:
            Path(tmp,"session.json").write_text(json.dumps({
                "pid":os.getpid(),"status":"idle","updatedAt":int(time.time()*1000)}))
            self.assertEqual(read_claude(Path(tmp)),"unknown")
if __name__=="__main__":unittest.main()
