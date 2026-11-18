#!/usr/bin/env python3
"""statusLine de Claude Code para WSL/Linux (equivale a claude-statusline.ps1 en Windows).

Guarda *solo* porcentajes de uso y épocas de reinicio de `rate_limits` en
~/.ocre-os/agent-monitor/claude-usage.json (esquema ocre-claude-usage-v1, runtime "wsl").
Nunca persiste modelo, sesión, rutas, credenciales ni datos de cuenta. Cualquier error se calla:
la statusLine jamás debe bloquear a Claude Code ni mostrar el JSON de entrada.
"""
import json
import math
import os
import sys
import tempfile
import time
from pathlib import Path

WINDOWS = ("five_hour", "seven_day")
LABELS = {"five_hour": "5h", "seven_day": "7d"}


def clean_windows(payload, now):
    limits = payload.get("rate_limits") if isinstance(payload, dict) else None
    clean = {}
    if not isinstance(limits, dict):
        return clean
    for name in WINDOWS:
        window = limits.get(name)
        if not isinstance(window, dict):
            continue
        used, reset = window.get("used_percentage"), window.get("resets_at")
        if type(used) not in (int, float) or type(reset) not in (int, float):
            continue
        if not (math.isfinite(used) and math.isfinite(reset)) or not 0 <= used <= 100:
            continue
        if not now < reset <= now + 1209600:
            continue
        clean[name] = {"used_percentage": float(used), "resets_at": int(reset)}
    return clean


def write_cache(clean, now, home=None):
    target_dir = Path(home or Path.home()) / ".ocre-os" / "agent-monitor"
    target_dir.mkdir(parents=True, exist_ok=True)
    snapshot = {"schema": "ocre-claude-usage-v1", "runtime": "wsl", "source": "claude_code_statusline",
                "observed_at": int(now), "windows": clean}
    fd, tmp = tempfile.mkstemp(prefix="claude-usage.", suffix=".tmp", dir=target_dir)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as handle:
            json.dump(snapshot, handle, separators=(",", ":"))
        os.replace(tmp, target_dir / "claude-usage.json")
    finally:
        if os.path.exists(tmp):
            os.unlink(tmp)


def main(stream=sys.stdin, out=sys.stdout, home=None, now=None):
    now = time.time() if now is None else now
    try:
        raw = stream.read(131073)
        if not raw or len(raw) > 131072:
            raise ValueError("payload")
        clean = clean_windows(json.loads(raw), now)
        if clean:
            write_cache(clean, now, home)
        parts = [f"{LABELS[n]}:{round(clean[n]['used_percentage'])}%" for n in WINDOWS if n in clean]
        out.write("OCRE Claude | " + (" ".join(parts) if parts else "cuota pendiente") + "\n")
    except Exception:  # noqa: BLE001 - la statusLine nunca debe fallar hacia Claude Code
        out.write("OCRE Claude | cuota no disponible\n")


if __name__ == "__main__":
    main()
