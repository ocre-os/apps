"""Cuota de Claude Code desde la caché local de la statusLine (`ocre-claude-usage-v1`). Sin secretos.

La statusLine solo se ejecuta durante sesiones interactivas de Claude Code, y las corridas sin interfaz
(`claude -p`, agentes) consumen cuota sin actualizarla. Por eso una lectura vieja no se presenta como
vigente: pasado CLAUDE_STATUSLINE_TTL el estado es `unknown`, pero se informa `observed_at` para que la
UI diga cuándo fue la última lectura real.
"""
import datetime as dt
import json
import math
import os
import stat
import time
from pathlib import Path

CLAUDE_STATUSLINE_TTL = 900
RUNTIMES = {"windows_interop", "wsl"}
WINDOWS = ("five_hour", "seven_day")
MAX_RESET_AHEAD = 1209600  # 14 días


def _iso(epoch):
    return dt.datetime.fromtimestamp(epoch, dt.timezone.utc).isoformat().replace("+00:00", "Z")


def _pct(value):
    # El contrato de la UI exige entero; 0.5 % nunca se clasifica como agotado.
    value = max(0.0, min(100.0, value))
    return 0 if value == 0 else max(1, int(value))


def _read_bounded(path):
    file = Path(path)
    # Rechaza enlaces simbólicos y junctions/reparse points de Windows en cualquier ancestro.
    for component in (file, *file.parents):
        if component.is_symlink() or (hasattr(component, "is_junction") and component.is_junction()):
            return None
    fd = os.open(str(file), os.O_RDONLY | getattr(os, "O_BINARY", 0))
    try:
        info = os.fstat(fd)
        if not stat.S_ISREG(info.st_mode) or info.st_size > 4096:
            return None
        raw = os.read(fd, 4097)
        if len(raw) > 4096:
            return None
        return json.loads(raw.decode("utf-8"))
    finally:
        os.close(fd)


def read_claude_quota(path, now=None):
    """Proyecta una caché de statusLine a la cuota de `ocre-devenv-v1`.

    Acepta una o ambas ventanas (Claude Code omite la que no tiene dato). La ventana con menos margen
    decide el estado; la semanal se publica aparte. Siempre incluye `observed_at` si la caché es válida.
    """
    unknown = {"state": "unknown", "remaining_percent": None, "resets_at": None}
    current = time.time() if now is None else now
    try:
        data = _read_bounded(path)
    except (OSError, ValueError, UnicodeError, RuntimeError, TypeError):
        return unknown
    if (not isinstance(data, dict) or data.get("schema") != "ocre-claude-usage-v1"
            or data.get("runtime") not in RUNTIMES or data.get("source") != "claude_code_statusline"):
        return unknown
    observed = data.get("observed_at")
    if type(observed) not in (int, float) or not math.isfinite(observed) or observed > current + 5:
        return unknown
    windows = data.get("windows")
    if not isinstance(windows, dict) or not windows or not set(windows) <= set(WINDOWS):
        return unknown
    checked = {}
    for name, record in windows.items():
        if not isinstance(record, dict):
            return unknown
        used, reset = record.get("used_percentage"), record.get("resets_at")
        if (type(used) not in (int, float) or type(reset) not in (int, float)
                or not math.isfinite(used) or not math.isfinite(reset) or not 0 <= used <= 100):
            return unknown
        if current < reset <= current + MAX_RESET_AHEAD:
            checked[name] = (100 - used, reset)
    stamp = _iso(observed)
    if current - observed > CLAUDE_STATUSLINE_TTL or not checked:
        return {**unknown, "observed_at": stamp}
    tight = min(checked.values(), key=lambda item: item[0])
    precise = max(0.0, min(100.0, tight[0]))
    result = {"state": "exhausted" if precise == 0 else "low" if precise <= 15 else "available",
              "remaining_percent": _pct(tight[0]), "resets_at": _iso(tight[1]), "observed_at": stamp}
    if "seven_day" in checked:
        week = checked["seven_day"]
        result["weekly"] = {"remaining_percent": _pct(week[0]), "resets_at": _iso(week[1])}
    else:
        result["weekly"] = None
    return result


def freshest(*quotas):
    """Entre varias lecturas (Windows y WSL), la de `observed_at` más reciente; las vigentes primero."""
    valid = [q for q in quotas if isinstance(q, dict) and q.get("observed_at")]
    if not valid:
        return next((q for q in quotas if isinstance(q, dict)), {"state": "unknown", "remaining_percent": None, "resets_at": None})
    return max(valid, key=lambda q: (q.get("state") != "unknown", q["observed_at"]))
