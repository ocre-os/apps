"""Windows observer: lifecycle metadata only, never transcript text."""
import argparse
import datetime as dt
import json
import os
from pathlib import Path
import sqlite3
import subprocess
import time
import urllib.request

def runtime_state(turns, pending, alive):
    if not alive:
        return "available"
    if not turns or any(s not in {"inProgress","completed","failed","interrupted"} for s in turns):
        return "unknown"
    if "command" in pending:
        return "working"
    if turns.count("inProgress") > pending.count("approval"):
        return "working"
    if "uncertain" in pending:
        return "unknown"
    if "approval" in pending:
        return "waiting"
    return "waiting"

TERMINAL_ITEM_STATUSES={None,"completed","failed","declined","interrupted"}

def pending_label(kind,value):
    """Classify one persisted item; anything active that is not understood is uncertain."""
    item_status=value.get("status")
    if kind=="commandExecution":
        if item_status=="inProgress":return "command"
        if value.get("processId") and value.get("exitCode") is None:return "uncertain"
        return "uncertain" if item_status not in TERMINAL_ITEM_STATUSES else None
    if kind in {"mcpToolCall","subAgentActivity","collabAgentToolCall"}:
        if item_status=="inProgress":
            if value.get("tool") in {"request_user_input","functions.request_user_input"}:
                return "approval"
            return "command"
        return "uncertain" if item_status not in TERMINAL_ITEM_STATUSES else None
    if kind in {"approvalRequest","requestUserInput"}:
        return "approval" if item_status!="completed" else None
    # fileChange inProgress or future item types: cannot confirm closure.
    return "uncertain" if item_status not in TERMINAL_ITEM_STATUSES else None

def inspect_projection(db, timestamp):
    turns=db.execute("""
      SELECT t.thread_id,t.turn_id,t.status,t.started_at,t.completed_at
      FROM thread_turns t WHERE t.rollout_ordinal =
      (SELECT MAX(s.rollout_ordinal) FROM thread_turns s WHERE s.thread_id=t.thread_id)
    """).fetchall()
    states=[]
    for thread,turn,status,started,ended in turns:
        if status not in {"inProgress","completed","failed","interrupted"}:
            states.append("unknown");continue
        # Pending work can outlive its turn, so inspect every turn of the thread.
        rows=db.execute("""
            SELECT turn_id,item_type,item_json,created_at_ms,started_at_ms,completed_at_ms
            FROM thread_items WHERE thread_id=?
        """,(thread,)).fetchall()
        current=[r for r in rows if r[0]==turn]
        latest=max([started or 0,ended or 0]+[
            max(created or 0,began or 0,done or 0)/1000 for _,_,_,created,began,done in current])
        # Persisted history is not a live engine connection. Expire uncertain
        # projections instead of republishing historical state as current.
        if timestamp-latest>30 or timestamp-latest< -5:
            states.append("unknown");continue
        pending=[]
        for item_turn,kind,raw,_,_,_ in rows:
            try:value=json.loads(raw)
            except ValueError:
                pending.append("uncertain");continue
            if not isinstance(value,dict):
                pending.append("uncertain");continue
            label=pending_label(kind,value)
            # An unfinished item of an earlier turn cannot be confirmed closed.
            if label and item_turn!=turn:label="uncertain"
            if label:pending.append(label)
        states.append(runtime_state([status],pending,True))
    if "working" in states:return "working"
    if not states or "unknown" in states:return "unknown"
    if "waiting" in states:return "waiting"
    return "available"

def codex_windows(home):
    try:
        result=subprocess.run(["powershell.exe","-NoProfile","-Command",
           "(Get-Process codex -ErrorAction SilentlyContinue | Measure-Object).Count"],
           capture_output=True,text=True,timeout=3,check=True)
        alive=int(result.stdout.strip())>0
        if not alive:return "available"
        db=sqlite3.connect("file:"+str(home/"thread_history_1.sqlite").replace("\\","/")+"?mode=ro",uri=True,timeout=1)
        try:return inspect_projection(db,time.time())
        finally:db.close()
    except (OSError,ValueError,sqlite3.Error,subprocess.SubprocessError):
        return "unknown"

def claude_wsl(collector):
    try:
        result=subprocess.run(["wsl.exe","-d","Ubuntu-24.04","-u","ocre","--","python3",
            collector,"--codex-dir","/home/ocre/.codex/sessions"],
            capture_output=True,text=True,timeout=4,check=True)
        return json.loads(result.stdout)["agents"]["claude"]["state"]
    except (OSError,ValueError,KeyError,subprocess.SubprocessError):
        return "unknown"

def snapshot(home,collector):
    stamp=dt.datetime.now(dt.timezone.utc).isoformat().replace("+00:00","Z")
    return {"contract":"ocre-agents-v1","observed_at":stamp,"agents":{
      "claude":{"state":claude_wsl(collector),"observed_at":stamp},
      "codex":{"state":codex_windows(home),"observed_at":stamp}}}

def main():
    p=argparse.ArgumentParser()
    p.add_argument("--codex-home",type=Path,default=Path(os.environ["USERPROFILE"])/".codex")
    p.add_argument("--collector",required=True)
    p.add_argument("--token-file",type=Path)
    p.add_argument("--url")
    p.add_argument("--output",type=Path)
    p.add_argument("--watch",action="store_true")
    a=p.parse_args()
    if a.url and (a.url!="https://staging.ocre.mx/api/agents" or not a.token_file):
        p.error("Only the approved Staging endpoint and a token file are allowed")
    while True:
        data=json.dumps(snapshot(a.codex_home,a.collector)).encode()
        if a.output:
            tmp=a.output.with_suffix(".tmp");tmp.write_bytes(data);tmp.replace(a.output)
        if a.url:
            try:
                req=urllib.request.Request(a.url,data=data,method="POST",headers={
                  "Content-Type":"application/json","Authorization":"Bearer "+a.token_file.read_text().strip()})
                with urllib.request.urlopen(req,timeout=3) as response:response.read(1024)
            except (OSError,ValueError):print("Monitor: envio no disponible.",flush=True)
        else:print(data.decode(),flush=True)
        if not a.watch:return
        time.sleep(5)
if __name__=="__main__":main()
