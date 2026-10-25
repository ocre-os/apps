"""Windows observer: lifecycle metadata only, never transcript text."""
import argparse
import datetime as dt
import json
import re
import os
from pathlib import Path
import sqlite3
import subprocess
import threading
import time
import urllib.error
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

def item_activity(created,began,done):
    return max(created or 0,began or 0,done or 0)/1000

def inspect_projection(db, timestamp, engine_started=None):
    """State of the persisted Codex Desktop history.

    engine_started (epoch seconds of the oldest live Codex process) is positive evidence of
    which records can no longer be executing: a turn or item whose last activity predates the
    running engine is orphaned. Without it every unresolved record stays uncertain."""
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
            item_activity(created,began,done) for _,_,_,created,began,done in current])
        orphan=engine_started is not None and latest<engine_started
        if orphan:
            # The engine that wrote an unfinished turn is gone: nothing still executes it.
            if status=="inProgress":status="interrupted"
        if engine_started is not None:
            rows=[r for r in rows if item_activity(r[3],r[4],r[5])>=engine_started]
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
        stale=timestamp-latest>30 or timestamp-latest< -5
        if stale:
            # Persisted history is not a live engine connection: expire uncertain
            # projections instead of republishing historical state as current. Only a
            # resolved history under a known live engine proves nothing is in flight.
            idle=(engine_started is not None and timestamp>=latest and not pending
                  and status in {"completed","failed","interrupted"})
            states.append("available" if idle else "unknown");continue
        states.append(runtime_state([status],pending,True))
    if "working" in states:return "working"
    if not states or "unknown" in states:return "unknown"
    if "waiting" in states:return "waiting"
    return "available"

def codex_turn_seconds(db, timestamp, engine_started=None):
    """Antigüedad del turno `inProgress` más largo de Codex Desktop que sigue en ejecución. Solo tiempo."""
    ages=[]
    rows=db.execute("""
      SELECT t.thread_id,t.turn_id,t.status,t.started_at
      FROM thread_turns t WHERE t.rollout_ordinal =
      (SELECT MAX(s.rollout_ordinal) FROM thread_turns s WHERE s.thread_id=t.thread_id)
    """).fetchall()
    for thread,turn,status,started in rows:
        if status!="inProgress" or not isinstance(started,(int,float)):continue
        items=db.execute("SELECT created_at_ms,started_at_ms,completed_at_ms FROM thread_items WHERE thread_id=? AND turn_id=?",
                         (thread,turn)).fetchall()
        latest=max([started]+[item_activity(*item) for item in items])
        # Un turno anterior al motor vivo está huérfano; uno sin actividad reciente no se presenta como en curso.
        if engine_started is not None and latest<engine_started:continue
        if timestamp-latest>30 or timestamp-latest< -5:continue
        age=timestamp-started
        if 0<=age<=7*86400:ages.append(int(age))
    return max(ages) if ages else None

def codex_desktop_turn(home):
    try:
        result=subprocess.run(["powershell.exe","-NoProfile","-Command",
           "Get-Process codex -ErrorAction SilentlyContinue | ForEach-Object { "
           "[int](($_.StartTime.ToUniversalTime() - [datetime]'1970-01-01').TotalSeconds) }"],
           capture_output=True,text=True,timeout=3,check=True)
        starts=parse_start_times(result.stdout)
        if not starts:return None
        db=sqlite3.connect("file:"+str(home/"thread_history_1.sqlite").replace("\\","/")+"?mode=ro",uri=True,timeout=1)
        try:return codex_turn_seconds(db,time.time(),min(starts))
        finally:db.close()
    except (OSError,ValueError,sqlite3.Error,subprocess.SubprocessError):
        return None

def parse_start_times(output):
    """Epoch start times (one per line) of the live Codex Desktop processes."""
    return [int(line) for line in output.split() if line.strip().isdigit()]

def codex_windows(home):
    try:
        result=subprocess.run(["powershell.exe","-NoProfile","-Command",
           "Get-Process codex -ErrorAction SilentlyContinue | ForEach-Object { "
           "[int](($_.StartTime.ToUniversalTime() - [datetime]'1970-01-01').TotalSeconds) }"],
           capture_output=True,text=True,timeout=3,check=True)
        starts=parse_start_times(result.stdout)
        if not starts:
            # No output at all means no process; unparseable output is not proof.
            return "unknown" if result.stdout.strip() else "available"
        db=sqlite3.connect("file:"+str(home/"thread_history_1.sqlite").replace("\\","/")+"?mode=ro",uri=True,timeout=1)
        try:return inspect_projection(db,time.time(),min(starts))
        finally:db.close()
    except (OSError,ValueError,sqlite3.Error,subprocess.SubprocessError):
        return "unknown"

def combine_states(states):
    """One verdict per source; any unknown source keeps the agent unknown unless work is proven."""
    if "working" in states:return "working"
    if not states or "unknown" in states:return "unknown"
    if "waiting" in states:return "waiting"
    return "available"

def wsl_agents(collector):
    try:
        result=subprocess.run(["wsl.exe","-d","Ubuntu-24.04","-u","ocre","--","python3",
            collector,"--codex-dir","/home/ocre/.codex/sessions"],
            capture_output=True,text=True,timeout=4,check=True)
        agents=json.loads(result.stdout)["agents"]
        return agents["claude"]["state"],agents["codex"]["state"]
    except (OSError,ValueError,KeyError,subprocess.SubprocessError):
        return "unknown","unknown"

def snapshot(home,collector):
    stamp=dt.datetime.now(dt.timezone.utc).isoformat().replace("+00:00","Z")
    claude,codex_cli=wsl_agents(collector)
    # Codex runs both as the Windows desktop app and as the CLI inside WSL.
    codex=combine_states([codex_windows(home),codex_cli])
    return {"contract":"ocre-agents-v1","observed_at":stamp,"agents":{
      "claude":{"state":claude,"observed_at":stamp},
      "codex":{"state":codex,"observed_at":stamp}}}

QUOTA_REFRESH_SECONDS=300
DEVENV_REFRESH_SECONDS=15
APPROVED_URLS=("https://staging.ocre.mx/api/agents","https://staging.ocre.mx/api/devenv")

class DevenvSource:
    """Arma la muestra `ocre-devenv-v1`; la cuota cambia despacio y se consulta cada QUOTA_REFRESH_SECONDS."""
    def __init__(self,home,collector,clock=time.time):
        self.home,self.collector,self.clock=home,collector,clock
        self.quota=None;self.quota_at=0.0
        self.runtime_script=Path("/home/ocre/src/ocre-os/core/scripts/provider-runtime-status.py")

    def wsl(self,with_quota):
        command=["wsl.exe","-d","Ubuntu-24.04","-u","ocre","--","python3",self.collector,
                 "--codex-dir","/home/ocre/.codex/sessions","--devenv"]+(["--quota"] if with_quota else [])
        try:
            result=subprocess.run(command,capture_output=True,text=True,timeout=40 if with_quota else 20,check=True)
            return json.loads(result.stdout)
        except (OSError,ValueError,subprocess.SubprocessError):
            return None

    def sample(self):
        now=self.clock()
        refresh=now-self.quota_at>=QUOTA_REFRESH_SECONDS
        data=self.wsl(refresh)
        if refresh and isinstance(data,dict) and isinstance(data.get("codex_quota"),dict):
            self.quota,self.quota_at=data["codex_quota"],now
        runtime=self.runtime_observation()
        sampled_at=self.clock()
        return build_devenv_sample(data,codex_desktop_turn(self.home),self.quota,sampled_at,
                                   runtime_inventory=runtime,runtime_observed_at=dt.datetime.fromtimestamp(sampled_at,dt.timezone.utc).isoformat().replace("+00:00","Z"))

    def runtime_observation(self):
        cmd=["wsl.exe","-d","Ubuntu-24.04","-u","ocre","--","python3",
             str(self.runtime_script),"--public-observation"]
        try:
            response=subprocess.run(cmd,capture_output=True,text=True,timeout=15,check=True)
            data=json.loads(response.stdout)
            return data if isinstance(data,dict) else None
        except (OSError,ValueError,subprocess.SubprocessError):
            return None

def clean_validations(raw):
    """Revalida los resultados antes de publicarlos: hora UTC, revisión hexadecimal y pass/fail; todo lo demás se descarta."""
    out=[]
    for item in raw if isinstance(raw,list) else []:
        if not isinstance(item,dict) or item.get("result") not in ("pass","fail") or not (isinstance(item.get("sha"),str) and re.fullmatch(r"[0-9a-f]{7,40}",item["sha"])):
            continue
        try:
            dt.datetime.strptime(item.get("at"),"%Y-%m-%dT%H:%M:%SZ")
        except (ValueError,TypeError):
            continue
        out.append({"at":item["at"],"sha":item["sha"],"result":item["result"]})
    return out[:3]

def clean_supervisor(raw):
    """Revalida el resumen del supervisor antes de publicarlo; ante cualquier duda no se publica."""
    keys={"at":str,"phase":str,"mode":str,"stopped":bool,"valid":int,"rejected":int,"launched":int}
    if not isinstance(raw,dict) or set(raw)!=set(keys):
        return None
    for key,kind in keys.items():
        value=raw[key]
        if not isinstance(value,kind) or (kind is int and (isinstance(value,bool) or not 0<=value<=999)):
            return None
    try:
        dt.datetime.strptime(raw["at"],"%Y-%m-%dT%H:%M:%SZ")
    except ValueError:
        return None
    if raw["phase"] not in ("F0","F1","F2","F3") or raw["mode"] not in ("observe","run"):
        return None
    return dict(raw)

def sanitize_runtime_inventory(raw, observed_at, now):
    """Translate Core's advisory runtime inventory to the public allowlist.

    Only explicitly observed authentication is published; a CLI login never proves quota.
    No timestamps are synthesized for cached runtime observations.
    """
    if not isinstance(raw,dict) or not isinstance(observed_at,str):
        return {}
    try:
        at=dt.datetime.fromisoformat(observed_at.replace("Z","+00:00"))
        if at.tzinfo is None or not 0 <= now-at.timestamp() <= 30:
            return {}
    except (ValueError,TypeError,OverflowError):
        return {}
    out={}
    for name in ("codex_wsl","claude_wsl","claude_windows"):
        item=raw.get(name)
        if not isinstance(item,dict):
            continue
        stamp=item.get("observed_at")
        try:
            observed=dt.datetime.fromisoformat(stamp.replace("Z","+00:00"))
            if observed.tzinfo is None or not 0 <= now-observed.timestamp() <= 30 or observed>at:
                continue
        except (ValueError,TypeError,AttributeError,OverflowError):
            continue
        auth=item.get("authentication")
        executable=item.get("executable")
        if executable=="unavailable":
            state="unavailable"
        elif auth in ("authenticated","unauthenticated") and item.get("reason")=="explicit_loggedIn":
            state=auth
        else:
            state="unknown"
        quota=item.get("quota")
        # Core's inventory may explicitly report verified Codex availability.
        # Claude quota is unknown even when authentication succeeds.
        quota_state=quota if name=="codex_wsl" and quota in ("available","low","exhausted") else "unknown"
        out[name]={"state":state,"quota_state":quota_state,"observed_at":stamp}
    return out

def build_devenv_sample(data, codex_turn, codex_quota, now, runtime_inventory=None, runtime_observed_at=None):
    """None si las reservas no se pudieron leer: no se afirma una carga que no se midió."""
    slots=data.get("slots") if isinstance(data,dict) else None
    if not isinstance(slots,dict) or not all(isinstance(slots.get(k),int) for k in ("claude","codex")):
        return None
    unknown={"state":"unknown","remaining_percent":None,"resets_at":None}
    events=[e for e in (data.get("events") or []) if isinstance(e,dict)][:5]
    stamp=dt.datetime.fromtimestamp(now,dt.timezone.utc).isoformat().replace("+00:00","Z")
    runtimes=sanitize_runtime_inventory(runtime_inventory,runtime_observed_at,now)
    return {"contract":"ocre-devenv-v1","observed_at":stamp,"agents":{
        "claude":{"slots_used":slots["claude"],"turn_seconds":data.get("claude_turn_seconds"),"quota":unknown},
        "codex":{"slots_used":slots["codex"],"turn_seconds":codex_turn,"quota":codex_quota or unknown}},
        "events":events,"validations":clean_validations(data.get("validations")),"supervisor":clean_supervisor(data.get("supervisor")),"runtimes":runtimes or None}

def publish_devenv(source,url,token_file,stop):
    """Hilo propio: un fallo o una lentitud aquí nunca retrasa la muestra de agentes."""
    while not stop.is_set():
        try:
            sample=source.sample()
            if sample:
                req=build_request(url,json.dumps(sample).encode(),token_file.read_text().strip())
                with urllib.request.urlopen(req,timeout=3) as response:response.read(1024)
        except urllib.error.HTTPError as error:print(f"Monitor devenv: envio rechazado (HTTP {error.code}).",flush=True)
        except (OSError,ValueError,subprocess.SubprocessError):print("Monitor devenv: envio no disponible.",flush=True)
        stop.wait(DEVENV_REFRESH_SECONDS)

USER_AGENT="OCRE-Agent-Monitor/1"

def build_request(url,data,token):
    # A named client is required: the edge blocks the default Python user agent.
    return urllib.request.Request(url,data=data,method="POST",headers={
        "Content-Type":"application/json","User-Agent":USER_AGENT,
        "Authorization":"Bearer "+token})

def main():
    p=argparse.ArgumentParser()
    p.add_argument("--codex-home",type=Path,default=Path(os.environ["USERPROFILE"])/".codex")
    p.add_argument("--collector",required=True)
    p.add_argument("--token-file",type=Path)
    p.add_argument("--url")
    p.add_argument("--output",type=Path)
    p.add_argument("--watch",action="store_true")
    a=p.parse_args()
    if a.url and (a.url!=APPROVED_URLS[0] or not a.token_file):
        p.error("Only the approved Staging endpoint and a token file are allowed")
    stop=threading.Event()
    if a.url and a.watch:
        threading.Thread(target=publish_devenv,args=(DevenvSource(a.codex_home,a.collector),APPROVED_URLS[1],a.token_file,stop),daemon=True).start()
    while True:
        data=json.dumps(snapshot(a.codex_home,a.collector)).encode()
        if a.output:
            tmp=a.output.with_suffix(".tmp");tmp.write_bytes(data);tmp.replace(a.output)
        if a.url:
            try:
                req=build_request(a.url,data,a.token_file.read_text().strip())
                with urllib.request.urlopen(req,timeout=3) as response:response.read(1024)
            except urllib.error.HTTPError as error:print(f"Monitor: envio rechazado (HTTP {error.code}).",flush=True)
            except (OSError,ValueError):print("Monitor: envio no disponible.",flush=True)
        else:print(data.decode(),flush=True)
        if not a.watch:return
        time.sleep(5)
if __name__=="__main__":main()
