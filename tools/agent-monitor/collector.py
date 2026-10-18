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

def read_claude(directory, proc_root=Path("/proc")):
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
                # Claude rewrites this record only when its status changes, so a
                # long turn or idle spell is old but valid; identity-verified
                # liveness is the freshness proof. Future dates are not trusted.
                states.append("unknown" if alive and age< -5 else claude_state(session,alive))
            except (OSError,ValueError,KeyError):
                complete=False
        # CLI inventory is essential: absent records cannot prove availability.
        pids=[p.name for p in proc_root.iterdir() if p.name.isdigit()]
        found=[]
        for pid in pids:
            try:
                if (proc_root/pid/"comm").read_text().strip()=="claude":
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

def codex_processes(proc_root=Path("/proc")):
    """PIDs of running Codex CLI processes, or None when the inventory cannot be read."""
    try:
        found=[]
        for entry in proc_root.iterdir():
            if not entry.name.isdigit():
                continue
            try:
                if (entry/"comm").read_text().strip()=="codex":
                    found.append(entry.name)
            except OSError:
                continue
        return found
    except OSError:
        return None

def read_codex(directory, proc_root=Path("/proc")):
    # Absence of any codex process proves there is no session: available.
    # With a process alive, rollouts prove a running turn only while events are
    # recent. They do not provide a complete inventory of approvals/background
    # tasks, so we never infer waiting from a completed transcript.
    alive=codex_processes(proc_root)
    if alive is None:
        return "unknown"
    if not alive:
        return "available"
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

def claude_turn_seconds(directory, now=None):
    """Antigüedad del turno `busy` más largo con proceso vivo. Solo tiempo: nada del contenido."""
    now=time.time() if now is None else now
    ages=[]
    try:
        for path in directory.glob("*.json"):
            try:
                session=json.loads(path.read_text())
                if session.get("status")!="busy" or not session.get("procStart") or not session.get("updatedAt"):
                    continue
                if not process_alive(session["pid"],session["procStart"]):
                    continue
                age=now-float(session["updatedAt"])/1000
                if 0<=age<=7*86400:ages.append(int(age))
            except (OSError,ValueError,KeyError,TypeError):
                continue
    except OSError:
        return None
    return max(ages) if ages else None

def slots_by_provider(status, capacity=2):
    """Reservas activas por proveedor efectivo, a partir de `ocre-agent status`. Solo conteos."""
    counts={"claude":0,"codex":0}
    items=status.get("reservations") if isinstance(status,dict) else None
    if not isinstance(items,list):
        return None
    for item in items:
        provider=item.get("effective_provider") or item.get("provider") if isinstance(item,dict) else None
        if provider in counts:counts[provider]+=1
    return {key:min(value,capacity) for key,value in counts.items()}

LOW_QUOTA_PERCENT=15

def quota_view(snapshot, now=None):
    """Cuota de Codex (salida de agent-quota.py) como estado fijo y la ventana con menos margen."""
    now=time.time() if now is None else now
    unknown={"state":"unknown","remaining_percent":None,"resets_at":None}
    data=snapshot.get("snapshot") if isinstance(snapshot,dict) else None
    if not isinstance(data,dict):
        return unknown
    windows=[w for w in data.get("windows",[]) if isinstance(w,dict)
             and isinstance(w.get("remaining"),(int,float)) and isinstance(w.get("resets_at"),(int,float))]
    if data.get("blocked"):
        reset=min((w["resets_at"] for w in windows),default=None)
        return {"state":"exhausted","remaining_percent":0,
                "resets_at":dt.datetime.fromtimestamp(reset,dt.timezone.utc).isoformat().replace("+00:00","Z") if reset else None}
    if not windows or not data.get("complete"):
        return unknown
    tight=min(windows,key=lambda w:w["remaining"])
    remaining=max(0,min(100,int(tight["remaining"])))
    return {"state":"exhausted" if remaining==0 else "low" if remaining<=LOW_QUOTA_PERCENT else "available",
            "remaining_percent":remaining,
            "resets_at":dt.datetime.fromtimestamp(tight["resets_at"],dt.timezone.utc).isoformat().replace("+00:00","Z")}

def run_json(command, timeout):
    try:
        result=subprocess.run(command,capture_output=True,text=True,timeout=timeout,check=True)
        return json.loads(result.stdout)
    except (OSError,ValueError,subprocess.SubprocessError):
        return None

def collect_devenv(claude_directory, core_scripts, with_quota=False, runner=run_json, now=None,
                   ocre_agent=Path("/home/ocre/.local/bin/ocre-agent"), codex_binary=Path("/home/ocre/.local/bin/codex")):
    """Parte WSL de `ocre-devenv-v1`: reservas por proveedor, turno de Claude y, si se pide, cuota de Codex."""
    slots=slots_by_provider(runner([str(ocre_agent),"status"],15))
    result={"slots":slots,"claude_turn_seconds":claude_turn_seconds(claude_directory,now)}
    if with_quota:
        result["codex_quota"]=quota_view(runner(["python3",str(core_scripts/"agent-quota.py"),"--codex-binary",str(codex_binary)],25),now)
    return result

def collect_snapshot(claude_directory, codex_directory, proc_root=Path("/proc")):
    stamp=utc_now()
    return {"contract":"ocre-agents-v1","observed_at":stamp,"agents":{
        "claude":{"state":read_claude(claude_directory,proc_root),"observed_at":stamp},
        "codex":{"state":read_codex(codex_directory,proc_root),"observed_at":stamp}}}

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("--claude-dir",type=Path,default=Path.home()/".claude/sessions")
    parser.add_argument("--codex-dir",type=Path,required=True)
    parser.add_argument("--output",type=Path)
    parser.add_argument("--url")
    parser.add_argument("--token-file",type=Path)
    parser.add_argument("--watch",action="store_true")
    parser.add_argument("--devenv",action="store_true")
    parser.add_argument("--quota",action="store_true")
    parser.add_argument("--core-scripts",type=Path,default=Path("/home/ocre/src/ocre-os/core/scripts"))
    args=parser.parse_args()
    if args.devenv:
        print(json.dumps(collect_devenv(args.claude_dir,args.core_scripts,args.quota)))
        return
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
