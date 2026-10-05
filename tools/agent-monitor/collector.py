"""Read-only activity collector. No conversation content leaves this process."""
import argparse
import datetime as dt
import json
import os
from pathlib import Path
import subprocess
import time
import urllib.request

def claude_state(session, alive):
    if not alive:
        return "available"
    return {"busy":"working", "idle":"waiting"}.get(session.get("status"), "unknown")

def codex_state(events, alive, background_verified=False):
    if not alive:
        return "available"
    active=set()
    seen=False
    for event in events:
        kind=event.get("type")
        turn=event.get("turn_id")
        if kind=="task_started" and turn:
            active.add(turn)
            seen=True
        elif kind in {"task_complete","turn_aborted"} and turn:
            active.discard(turn)
            seen=True
    if active:
        return "working"
    if seen and background_verified:
        return "waiting"
    return "unknown"

def aggregate(states, complete):
    if "working" in states:
        return "working"
    if not complete or "unknown" in states:
        return "unknown"
    if "waiting" in states:
        return "waiting"
    return "available"

def utc_now():
    return dt.datetime.now(dt.timezone.utc).isoformat().replace("+00:00","Z")

def process_alive(pid, identity=None):
    try:
        os.kill(int(pid),0)
        if identity:
            fields=Path(f"/proc/{pid}/stat").read_text().rsplit(")",1)[1].split()
            if str(identity)!=fields[19]:
                return False
        return True
    except (OSError,ValueError,IndexError):
        return False

def read_claude(directory):
    states=[]
    complete=True
    try:
        for path in directory.glob("*.json"):
            try:
                session=json.loads(path.read_text())
                if not session.get("procStart") or not session.get("updatedAt"):
                    states.append("unknown")
                    continue
                age=time.time()-float(session["updatedAt"])/1000
                alive=process_alive(session["pid"],session["procStart"])
                states.append("unknown" if alive and (age>30 or age< -5) else claude_state(session,alive))
            except (OSError,ValueError,KeyError):
                complete=False
        # CLI inventory is essential: absent records cannot prove availability.
        pids=[p.name for p in Path("/proc").iterdir() if p.name.isdigit()]
        found=[]
        for pid in pids:
            try:
                if Path(f"/proc/{pid}/comm").read_text().strip()=="claude":
                    found.append(pid)
            except FileNotFoundError:
                pass
        recorded={str(json.loads(p.read_text()).get("pid")) for p in directory.glob("*.json")}
        if set(found)-recorded:
            complete=False
        if not directory.is_dir():
            complete=False
    except (OSError,ValueError):
        complete=False
    return aggregate(states,complete)

def read_codex(directory):
    # Rollouts prove a running turn only while events are recent. They do not
    # provide a complete inventory of approvals/background tasks, so we never
    # infer waiting/availability from a completed transcript.
    states=[]
    now=time.time()
    try:
        files=list(directory.rglob("*.jsonl"))
        if not directory.is_dir():
            return "unknown"
        for path in files:
            if now-path.stat().st_mtime>30:
                continue
            events=[]
            with path.open(encoding="utf-8") as stream:
                for line in stream:
                    record=json.loads(line)
                    if record.get("type")=="event_msg":
                        events.append(record.get("payload",{}))
            states.append(codex_state(events,True,False))
    except (OSError,ValueError):
        return "unknown"
    return aggregate(states,False)

def collect_snapshot(claude_directory, codex_directory):
    stamp=utc_now()
    return {"contract":"ocre-agents-v1","observed_at":stamp,"agents":{
        "claude":{"state":read_claude(claude_directory),"observed_at":stamp},
        "codex":{"state":read_codex(codex_directory),"observed_at":stamp}}}

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("--claude-dir",type=Path,default=Path.home()/".claude/sessions")
    parser.add_argument("--codex-dir",type=Path,required=True)
    parser.add_argument("--output",type=Path)
    parser.add_argument("--url")
    parser.add_argument("--token-file",type=Path)
    parser.add_argument("--watch",action="store_true")
    args=parser.parse_args()
    if args.url and (args.url!="https://staging.ocre.mx/api/agents" or not args.token_file):
        parser.error("HTTPS URL and token file required for publishing")
    while True:
        payload=json.dumps(collect_snapshot(args.claude_dir,args.codex_dir)).encode()
        if args.output:
            temporary=args.output.with_suffix(".tmp")
            temporary.write_bytes(payload)
            temporary.replace(args.output)
        if args.url:
            try:
                request=urllib.request.Request(args.url,data=payload,method="POST",
                    headers={"Content-Type":"application/json","Authorization":"Bearer "+args.token_file.read_text().strip()})
                with urllib.request.urlopen(request,timeout=3) as response:
                    response.read(1024)
            except (OSError,ValueError):
                # Never echo headers, URLs, tokens or exception text.
                print("Monitor: no se pudo enviar la muestra.",flush=True)
        elif not args.output:
            print(payload.decode(),flush=True)
        if not args.watch:
            return
        time.sleep(5)
if __name__=="__main__": main()
