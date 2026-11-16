# VERSE CLOCK — cálculo para ChatGPT (Code Interpreter). Port de src/engine.js.
# Adaptado de VerseTime (dydrmr), GPL-3.0. Predicción astronómica, no telemetría del servidor.
# Uso: python verse_clock.py "HDSF-Elbridge"   (requiere locations.json en la misma carpeta)
import json, sys, os, math
from datetime import datetime, timezone, timedelta
from zoneinfo import ZoneInfo

EPOCH = datetime(2020, 1, 1, tzinfo=timezone.utc)
mod = lambda a, b: ((a % b) + b) % b

def load(path=None):
    path = path or os.path.join(os.path.dirname(os.path.abspath(__file__)), "locations.json")
    with open(path, encoding="utf-8") as f:
        return json.load(f)["locations"]

def find(locs, q):
    q = q.lower().strip()
    exact = [l for l in locs if l["name"].lower() == q]
    return exact or [l for l in locs if q in l["name"].lower()]

def compute(p, now=None):
    now = now or datetime.now(timezone.utc)
    ms = (now - EPOCH).total_seconds() * 1000
    days = ms / 86400000
    lod = p["lengthOfDayDays"]
    body_ha = mod(360 - mod(days / lod, 1) * 360 - p["rotationCorrection"], 360)
    ha = mod(body_ha - mod(p["longitude360"] - p["staticMeridian"], 360), 360)
    ha = ha - 360 if ha > 180 else ha
    local = 86400 * (360 - (ha + 180)) / 360
    rs, rate = p["riseSetAngle"], p["angularRate"]
    out = {"ubicacion": p["name"], "cuerpo": p["body"], "sistema": p["system"],
           "utc": now.isoformat(timespec="seconds"), "hora_local_juego": fmt(local),
           "duracion_dia_min_reales": round(lod * 1440, 1)}
    if rs is None:
        out["ciclo"] = "polar: sin amanecer/anochecer ordinario"
        return out
    next_noon = (ha if ha > 0 else 360 + ha) / rate / 1440
    offs = (rs / rate) * 3 / 4300
    rise = next_noon - offs + (lod if (not ha > rs and ha > 0) else 0)
    sset = next_noon + offs - (lod if (ha > -rs and not ha > 0) else 0)
    mad = ZoneInfo("Europe/Madrid")
    frac = (1 - (2 * rs / rate * 3 / 4300) / lod) / 2
    out["fase"] = "día" if frac * 86400 < local < (1 - frac) * 86400 else "noche"
    for k, d in (("amanecer", rise), ("anochecer", sset)):
        t = now + timedelta(days=d)
        out[f"proximo_{k}_madrid"] = t.astimezone(mad).strftime("%H:%M:%S")
        out[f"proximo_{k}_en_min"] = round(d * 1440, 1)
        if d * 86400 < 90 or d * 86400 > lod * 86400 - 90:
            out[f"proximo_{k}_en_min"] = "ocurriendo ahora (±90 s)"
    return out

def fmt(sec):
    sec = int(mod(math.floor(sec), 86400))
    return f"{sec//3600:02d}:{sec%3600//60:02d}:{sec%60:02d}"

if __name__ == "__main__":
    locs = load()
    hits = find(locs, " ".join(sys.argv[1:]) or "HDSF-Elbridge")
    if not hits:
        print("Ubicación no encontrada"); sys.exit(1)
    for p in hits[:5]:
        print(json.dumps(compute(p), ensure_ascii=False, indent=1))
