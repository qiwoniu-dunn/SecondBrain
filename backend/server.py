#!/usr/bin/env python3
"""SecondBrain Daily Digest H5 Server — 支持 输入清单 + 二脑日报 双 Tab"""

import fcntl
import hashlib
import hmac
import json
import logging
import os
import re
import subprocess
import time
from pathlib import Path
from fastapi import Depends, FastAPI, Request
from fastapi.responses import FileResponse, JSONResponse

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("sb-server")

app = FastAPI()

BASE_DIR = Path("/opt/sb-digest")
DIGESTS_DIR = BASE_DIR / "data" / "digests"
DAILY_DIR = BASE_DIR / "daily"
MARKINGS_FILE = BASE_DIR / "data" / "markings.json"
H5_DIR = BASE_DIR / "h5"
README_FILE = BASE_DIR / "docs" / "readme.md"
ROADMAP_FILE = BASE_DIR / "docs" / "SecondBrain-Roadmap-v2.md"
HEARTBEAT_FILE = BASE_DIR / "data" / "heartbeat.json"
HEARTBEAT_DIR = BASE_DIR / "data" / "heartbeats"
HEARTBEAT_TIMEOUT_SECONDS = 900
TRIGGER_FILE = BASE_DIR / "data" / "trigger-ingest"
METRICS_FILE = BASE_DIR / "data" / "metrics.json"

AUTH_PASSWORD = os.environ.get("SB_AUTH_PASSWORD", "")
DATE_PATTERN = re.compile(r"^\d{4}-\d{2}-\d{2}$")

MILESTONE_CACHE = {"mtime": None, "data": None}
_METRICS_CACHE = {"ts": 0, "data": None}
_METRICS_CACHE_TTL = 60

# Active tokens store: {token: expiry_timestamp}
_ACTIVE_TOKENS: dict[str, float] = {}
_TOKEN_TTL = 7 * 24 * 3600  # 7 days


# ── Auth ──────────────────────────────────────────

def _generate_token(client_ip: str) -> str:
    import secrets
    token = secrets.token_hex(24)
    _ACTIVE_TOKENS[token] = time.time() + _TOKEN_TTL
    # Cleanup expired tokens
    now = time.time()
    expired = [k for k, v in _ACTIVE_TOKENS.items() if v < now]
    for k in expired:
        _ACTIVE_TOKENS.pop(k, None)
    return token


def _verify_token(token: str) -> bool:
    if not token:
        return False
    expiry = _ACTIVE_TOKENS.get(token)
    if expiry is None:
        return False
    return time.time() < expiry


async def require_auth(request: Request):
    auth = request.headers.get("authorization", "")
    if auth.startswith("Bearer "):
        token = auth[7:]
    else:
        token = request.query_params.get("token", "")

    if not _verify_token(token):
        raise HTTPException(status_code=401, detail="Unauthorized")


# Import HTTPException after app init
from fastapi import HTTPException  # noqa: E402


# ── ECS Health Helper ────────────────────────────

def _get_ecs_health() -> dict:
    try:
        uptime_raw = subprocess.check_output(["uptime", "-p"], timeout=5).decode().strip().replace("up ", "")
        load_raw = Path("/proc/loadavg").read_text().split()
        load1 = float(load_raw[0])
        nproc = int(subprocess.check_output(["nproc"], timeout=5).decode().strip())
        cpu_pct = round(load1 / nproc * 100, 1)
        meminfo = Path("/proc/meminfo").read_text()
        mem_total = int(re.search(r"MemTotal:\s+(\d+)", meminfo).group(1))
        mem_avail = int(re.search(r"MemAvailable:\s+(\d+)", meminfo).group(1))
        mem_pct = round((1 - mem_avail / mem_total) * 100, 1)
        df = subprocess.check_output(["df", "/"], timeout=5).decode().split("\n")[1].split()
        disk_pct = int(df[4].replace("%", ""))
        import datetime
        return {
            "online": True, "uptime": uptime_raw,
            "cpu": cpu_pct, "memory": mem_pct, "disk": disk_pct,
            "last_check": datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC"),
        }
    except Exception:
        return {"online": True}


# ── Public Endpoints (no auth) ──────────────────

@app.post("/api/auth")
def verify_password(body: dict, request: Request):
    pwd = body.get("password", "")
    if hmac.compare_digest(pwd, AUTH_PASSWORD):
        ip = request.headers.get("x-forwarded-for", "").split(",")[0].strip()
        if not ip:
            ip = request.client.host if request.client else ""
        token = _generate_token(ip)
        logger.info("Auth success from %s", ip)
        return {"ok": True, "token": token}
    logger.warning("Auth failed from %s", request.client.host if request.client else "unknown")
    return JSONResponse({"ok": False}, status_code=401)


@app.get("/api/ip")
def get_client_ip(request: Request):
    ip = request.headers.get("x-forwarded-for", "").split(",")[0].strip()
    if not ip:
        ip = request.client.host if request.client else "unknown"
    return {"ip": ip}


@app.get("/")
def index():
    return FileResponse(H5_DIR / "index.html")


# ── Authenticated Endpoints ─────────────────────

@app.get("/api/dates")
def list_all_dates(_: None = Depends(require_auth)):
    digest_dates = set()
    if DIGESTS_DIR.exists():
        digest_dates = {f.stem for f in DIGESTS_DIR.glob("*.json")}

    sbdaily_dates = set()
    if DAILY_DIR.exists():
        for f in DAILY_DIR.glob("SBdaily-*.md"):
            sbdaily_dates.add(f.stem.replace("SBdaily-", ""))

    all_dates = sorted(digest_dates | sbdaily_dates, reverse=True)
    return {
        "dates": all_dates,
        "digest_dates": sorted(digest_dates, reverse=True),
        "sbdaily_dates": sorted(sbdaily_dates, reverse=True),
    }


@app.get("/api/digests")
def list_digests(_: None = Depends(require_auth)):
    dates = []
    if DIGESTS_DIR.exists():
        for f in sorted(DIGESTS_DIR.glob("*.json"), reverse=True):
            dates.append(f.stem)
    return {"dates": dates}


@app.get("/api/digest/{digest_date}")
def get_digest(digest_date: str, _: None = Depends(require_auth)):
    if not DATE_PATTERN.match(digest_date):
        return JSONResponse({"error": "invalid date format"}, status_code=400)
    filepath = DIGESTS_DIR / f"{digest_date}.json"
    if not filepath.exists():
        return JSONResponse({"error": "not found"}, status_code=404)

    digest = json.loads(filepath.read_text())

    markings = load_markings()  # read-only, no lock needed
    for article in digest.get("articles", []):
        aid = article["id"]
        if aid in markings.get("skip", []):
            article["skip_ingest"] = True

    return digest


@app.post("/api/digest/{digest_date}/mark")
def mark_article(digest_date: str, body: dict, _: None = Depends(require_auth)):
    if not DATE_PATTERN.match(digest_date):
        return JSONResponse({"error": "invalid date format"}, status_code=400)
    article_id = body.get("article_id", "")
    skip = body.get("skip", True)

    save_markings_locked(lambda markings: _apply_mark(markings, article_id, skip))

    logger.info("mark_article: %s skip=%s", article_id, skip)
    return {"ok": True, "article_id": article_id, "skip": skip}


@app.get("/api/sbdaily/{date}")
def get_sbdaily(date: str, _: None = Depends(require_auth)):
    if not DATE_PATTERN.match(date):
        return JSONResponse({"error": "invalid date format"}, status_code=400)
    filepath = DAILY_DIR / f"SBdaily-{date}.md"
    if not filepath.exists():
        return JSONResponse({"error": "not found"}, status_code=404)

    content = filepath.read_text(encoding="utf-8")

    meta = {}
    body = content
    if content.startswith("---"):
        parts = content.split("---", 2)
        if len(parts) >= 3:
            try:
                import yaml
                meta = yaml.safe_load(parts[1]) or {}
            except Exception:
                meta = {}
            body = parts[2].strip()

    return {"date": date, "meta": meta, "body_markdown": body, "available": True}


@app.get("/api/readme")
def get_readme(_: None = Depends(require_auth)):
    if not README_FILE.exists():
        return JSONResponse({"error": "not found", "body_markdown": ""}, status_code=404)
    content = README_FILE.read_text(encoding="utf-8")
    meta = {}
    body = content
    if content.startswith("---"):
        parts = content.split("---", 2)
        if len(parts) >= 3:
            try:
                import yaml
                meta = yaml.safe_load(parts[1]) or {}
            except Exception:
                meta = {}
            body = parts[2].strip()
    return {"body_markdown": body, "meta": meta}


@app.post("/api/trigger-ingest")
def trigger_ingest(_: None = Depends(require_auth)):
    import datetime
    TRIGGER_FILE.parent.mkdir(parents=True, exist_ok=True)
    TRIGGER_FILE.write_text(json.dumps({
        "triggered_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "triggered_by": "h5_button"
    }, ensure_ascii=False))
    logger.info("trigger-ingest created by H5 button")
    return {"ok": True, "message": "Trigger created"}


@app.get("/api/ingest-status")
def get_ingest_status(_: None = Depends(require_auth)):
    triggered = TRIGGER_FILE.exists()
    result = {"triggered": triggered}
    if triggered:
        try:
            data = json.loads(TRIGGER_FILE.read_text())
            result["triggered_at"] = data.get("triggered_at")
        except Exception:
            pass
    return result


@app.get("/api/last-ingest")
def get_last_ingest(_: None = Depends(require_auth)):
    import datetime
    if not DAILY_DIR.exists():
        return {"last_ingest": None}
    files = list(DAILY_DIR.glob("SBdaily-*.md"))
    if not files:
        return {"last_ingest": None}
    latest = max(files, key=lambda f: f.stat().st_mtime)
    mtime = datetime.datetime.fromtimestamp(latest.stat().st_mtime, tz=datetime.timezone.utc)
    return {"last_ingest": mtime.strftime("%Y-%m-%dT%H:%M:%SZ")}


@app.get("/api/heartbeat")
def get_all_heartbeats(_: None = Depends(require_auth)):
    import datetime

    def parse_ts(ts_str):
        if not ts_str:
            return None
        try:
            return datetime.datetime.fromisoformat(ts_str.replace("Z", "+00:00"))
        except Exception:
            return None

    def infer_machine_type(data, fallback_name):
        machine_type = data.get("machine_type", "unknown") or "unknown"
        if machine_type != "unknown":
            return machine_type
        name = f"{data.get('hostname', '')} {data.get('machine_label', '')} {fallback_name}".lower()
        if "mini" in name or "macmini" in name:
            return "mac_mini"
        if "macbook" in name or "book" in name:
            return "macbook"
        return "unknown"

    def normalize_label(machine_type, label, fallback):
        clean = (label or fallback or "").strip()
        if machine_type == "mac_mini" and clean.lower().replace(" ", "") in {"macmini", "mac_mini"}:
            return "Mac Mini"
        if machine_type == "macbook" and clean.lower() in {"macbook", "mac_book"}:
            return "MacBook"
        return clean or {"mac_mini": "Mac Mini", "macbook": "MacBook"}.get(machine_type, fallback)

    now = datetime.datetime.now(datetime.timezone.utc)
    latest_by_machine = {}

    if HEARTBEAT_DIR.exists():
        for f in HEARTBEAT_DIR.glob("*.json"):
            try:
                data = json.loads(f.read_text())
                ts_str = data.get("timestamp", "")
                ts = parse_ts(ts_str)
                if ts is None:
                    continue

                machine_type = infer_machine_type(data, f.stem)
                machine_label = normalize_label(machine_type, data.get("machine_label"), f.stem)
                machine_id = data.get("machine_id", "")
                key = machine_id or f"{machine_type}:{machine_label}".lower().replace(" ", "")

                previous = latest_by_machine.get(key)
                if previous is None or ts > previous["_ts"]:
                    age_seconds = (now - ts).total_seconds()
                    latest_by_machine[key] = {
                        "_ts": ts,
                        "hostname": data.get("hostname", machine_label),
                        "machine_type": machine_type,
                        "machine_label": machine_label,
                        "machine_id": machine_id,
                        "online": age_seconds < HEARTBEAT_TIMEOUT_SECONDS,
                        "last_seen": ts_str,
                        "age_seconds": max(0, int(age_seconds)),
                    }
            except Exception:
                pass

    machines = []
    for item in latest_by_machine.values():
        item.pop("_ts", None)
        machines.append(item)

    if HEARTBEAT_FILE.exists() and not machines:
        try:
            data = json.loads(HEARTBEAT_FILE.read_text())
            ts_str = data.get("timestamp", "")
            ts = parse_ts(ts_str)
            if ts is not None:
                hostname = data.get("hostname", "")
                age_seconds = (now - ts).total_seconds()
                machine_type = infer_machine_type(data, hostname)
                machines.append({
                    "hostname": hostname,
                    "machine_type": machine_type,
                    "machine_label": normalize_label(machine_type, "legacy", hostname),
                    "machine_id": "",
                    "online": age_seconds < HEARTBEAT_TIMEOUT_SECONDS,
                    "last_seen": ts_str,
                    "age_seconds": max(0, int(age_seconds)),
                })
        except Exception:
            pass

    order = {"mac_mini": 0, "macbook": 1, "unknown": 2}
    machines.sort(key=lambda m: order.get(m.get("machine_type", "unknown"), 9))
    return {"machines": machines}


@app.get("/api/ecs-health")
def get_ecs_health_endpoint(_: None = Depends(require_auth)):
    return _get_ecs_health()


@app.get("/api/metrics")
def get_metrics(_: None = Depends(require_auth)):
    # Check cache
    now_ts = time.time()
    cached = _METRICS_CACHE["data"]
    if cached and (now_ts - _METRICS_CACHE["ts"]) < _METRICS_CACHE_TTL:
        logger.debug("metrics cache hit (age=%.1fs)", now_ts - _METRICS_CACHE["ts"])
        return cached

    import datetime

    # Mac Mini metrics
    mac_metrics = {}
    metrics_source = "fallback"
    metrics_collected_at = None
    metrics_age_seconds = None

    if METRICS_FILE.exists():
        try:
            mac_metrics = json.loads(METRICS_FILE.read_text())
            if isinstance(mac_metrics, dict) and mac_metrics:
                metrics_source = mac_metrics.get("machine_type") or mac_metrics.get("source") or "mac_mini"
                metrics_collected_at = mac_metrics.get("collected_at")
                collected_ts = None
                if metrics_collected_at:
                    try:
                        collected_ts = datetime.datetime.fromisoformat(metrics_collected_at.replace("Z", "+00:00"))
                    except Exception:
                        pass
                if collected_ts:
                    now_utc = datetime.datetime.now(datetime.timezone.utc)
                    metrics_age_seconds = max(0, int((now_utc - collected_ts).total_seconds()))
                else:
                    metrics_age_seconds = max(0, int(time.time() - METRICS_FILE.stat().st_mtime))
        except Exception:
            mac_metrics = {}
            metrics_source = "fallback"

    # Wiki stats
    if mac_metrics.get("wiki"):
        wiki = mac_metrics["wiki"]
    else:
        wiki = {"total": 57, "concepts": 13, "domains": 5, "insights": 9, "people": 10, "projects": 12, "reflections": 8}
        metrics_source = "fallback"

    # Raw stats
    if mac_metrics.get("raw"):
        raw = mac_metrics["raw"]
    else:
        raw = {"articles": 0, "videos": 0, "ingested": 0, "pending": 0}
        articles_dir = BASE_DIR / "data" / "digests"
        video_dir = BASE_DIR / "raw" / "video"
        if articles_dir.exists():
            raw["articles"] = len(list(articles_dir.glob("*.json")))
        if video_dir.exists():
            raw["videos"] = len(list(video_dir.glob("*.md")))
        metrics_source = "fallback"

    # Pipeline
    if mac_metrics.get("pipeline"):
        pipeline = mac_metrics["pipeline"]
    else:
        pipeline = {"last_ingest": "", "last_sync": ""}

    if not pipeline.get("last_ingest") and DAILY_DIR.exists():
        daily_files = list(DAILY_DIR.glob("SBdaily-*.md"))
        if daily_files:
            latest = max(daily_files, key=lambda f: f.stat().st_mtime)
            mt = datetime.datetime.fromtimestamp(latest.stat().st_mtime, tz=datetime.timezone.utc)
            pipeline["last_ingest"] = mt.strftime("%Y-%m-%d %H:%M:%S UTC")

    pipeline.setdefault("daily_count", 0)

    # ECS health (shared helper)
    ecs = _get_ecs_health()

    # Logs
    logs = []

    if HEARTBEAT_FILE.exists():
        try:
            hb = json.loads(HEARTBEAT_FILE.read_text())
            ts = hb.get("timestamp", "")
            if ts:
                logs.append({"time": ts[:19].replace("T", " "), "type": "sync",
                    "message": "Mac Mini 心跳上报"})
        except Exception:
            pass

    if TRIGGER_FILE.exists():
        try:
            tr = json.loads(TRIGGER_FILE.read_text())
            ta = tr.get("triggered_at", "")
            by = tr.get("triggered_by", "unknown")
            if ta:
                logs.append({"time": ta[:19].replace("T", " "), "type": "ingest",
                    "message": f"Ingest 触发 (来源: {by})"})
        except Exception:
            pass

    if DAILY_DIR.exists():
        daily_files = sorted(DAILY_DIR.glob("SBdaily-*.md"),
            key=lambda f: f.stat().st_mtime, reverse=True)[:5]
        for f in daily_files:
            mt = datetime.datetime.fromtimestamp(f.stat().st_mtime, tz=datetime.timezone.utc)
            date_str = f.stem.replace("SBdaily-", "")
            logs.append({"time": mt.strftime("%Y-%m-%d %H:%M:%S"), "type": "ingest",
                "message": f"日报生成/更新: {date_str}"})

    if DIGESTS_DIR.exists():
        digest_files = sorted(DIGESTS_DIR.glob("*.json"),
            key=lambda f: f.stat().st_mtime, reverse=True)[:3]
        for f in digest_files:
            mt = datetime.datetime.fromtimestamp(f.stat().st_mtime, tz=datetime.timezone.utc)
            date_str = f.stem
            n_articles = len(json.loads(f.read_text()).get("articles", []))
            logs.append({"time": mt.strftime("%Y-%m-%d %H:%M:%S"), "type": "sync",
                "message": f"输入清单同步: {date_str} ({n_articles}条)"})

    logs.sort(key=lambda x: x.get("time", ""), reverse=True)

    milestones = load_milestones_from_roadmap()

    result = {
        "wiki": wiki,
        "raw": raw,
        "pipeline": pipeline,
        "metrics_source": metrics_source,
        "metrics_collected_at": metrics_collected_at,
        "metrics_age_seconds": metrics_age_seconds,
        "milestones": milestones,
        "logs": logs[:10],
        "ecs_health": ecs,
        "tag_stats": mac_metrics.get("tag_stats"),
        "graph_stats": mac_metrics.get("graph_stats"),
    }

    # Update cache
    _METRICS_CACHE["ts"] = time.time()
    _METRICS_CACHE["data"] = result

    return result


# ── Helpers ──────────────────────────────────────

def load_markings():
    if MARKINGS_FILE.exists():
        return json.loads(MARKINGS_FILE.read_text())
    return {"skip": []}


def save_markings(markings):
    MARKINGS_FILE.parent.mkdir(parents=True, exist_ok=True)
    MARKINGS_FILE.write_text(json.dumps(markings, ensure_ascii=False, indent=2))


def save_markings_locked(mutate_fn):
    """Read-modify-write markings.json with fcntl file lock for concurrency safety."""
    MARKINGS_FILE.parent.mkdir(parents=True, exist_ok=True)
    lock_path = MARKINGS_FILE.with_suffix(".lock")
    with open(lock_path, "w") as lock_f:
        fcntl.flock(lock_f, fcntl.LOCK_EX)
        try:
            markings = load_markings()
            mutate_fn(markings)
            save_markings(markings)
        finally:
            fcntl.flock(lock_f, fcntl.LOCK_UN)


def _apply_mark(markings: dict, article_id: str, skip: bool):
    skip_set = set(markings.get("skip", []))
    if skip:
        skip_set.add(article_id)
    else:
        skip_set.discard(article_id)
    markings["skip"] = sorted(skip_set)


def fallback_milestones():
    return [
        {"id": "m1", "title": "M1 基础系统上线", "completed": True, "items": []},
        {"id": "m2", "title": "M2 自动化与日报升级", "completed": True, "items": []},
        {"id": "m3", "title": "M3 输入渠道与 iCloud", "completed": True, "items": []},
        {"id": "m4", "title": "M4 本地文档导入", "completed": True, "items": []},
        {"id": "m5", "title": "M5 Mac Mini 接管", "completed": True, "items": []},
        {"id": "m6", "title": "M6 自动化稳定运行", "completed": True, "items": []},
        {"id": "m7", "title": "M7 日常使用闭环", "completed": False, "items": [
            {"label": "M7.1 管理看板", "done": True},
            {"label": "M7.2 H5 版本统一", "done": True},
            {"label": "M7.3 移动端 Wiki 问答入口", "done": False},
            {"label": "M7.4 Obsidian Claudian 对话（备选）", "done": False},
        ]},
        {"id": "m8", "title": "M8 系统可靠性", "completed": False, "items": [
            {"label": "M8.1 Ingest 失败告警", "done": False},
            {"label": "M8.2 SB-vault 自动备份", "done": False},
            {"label": "M8.3 ECS 关键文件备份", "done": False},
            {"label": "M8.4 基础访问统计", "done": False},
        ]},
        {"id": "m9", "title": "M9 信息渠道扩展", "completed": False, "items": [
            {"label": "M9.1 iOS 录音转写", "done": False},
            {"label": "M9.2 YouTube 字幕接入", "done": False},
            {"label": "M9.3 更多存量文档导入", "done": False},
        ]},
        {"id": "m10", "title": "M10 知识库智能化", "completed": False, "items": [
            {"label": "M10.1 Wikilink 自动化", "done": False},
            {"label": "M10.2 定期 Lint + 周报", "done": False},
            {"label": "M10.3 知识图谱可视化", "done": False},
            {"label": "M10.4 Top50 关键词频次", "done": False},
            {"label": "M10.5 主题分布统计", "done": False},
            {"label": "M10.6 页面分类占比可视化", "done": False},
        ]},
    ]


def load_milestones_from_roadmap():
    try:
        mtime = ROADMAP_FILE.stat().st_mtime
    except OSError:
        return MILESTONE_CACHE["data"] or fallback_milestones()

    if MILESTONE_CACHE["mtime"] == mtime and MILESTONE_CACHE["data"]:
        return MILESTONE_CACHE["data"]

    try:
        content = ROADMAP_FILE.read_text(encoding="utf-8")
        start = "<!-- dashboard-milestones:start -->"
        end = "<!-- dashboard-milestones:end -->"
        if start not in content or end not in content:
            raise ValueError("dashboard milestone markers not found")

        block = content.split(start, 1)[1].split(end, 1)[0]
        milestones = []
        current = None

        for raw_line in block.splitlines():
            line = raw_line.strip()
            heading = re.match(r"^###\s+(M\d+)\s+(.+)$", line)
            if heading:
                if current:
                    current["completed"] = bool(current["items"]) and all(i["done"] for i in current["items"])
                    milestones.append(current)
                mid = heading.group(1).lower()
                title = f"{heading.group(1)} {heading.group(2).strip()}"
                current = {"id": mid, "title": title, "completed": False, "items": []}
                continue

            item = re.match(r"^-\s+\[([ xX])\]\s+(.+)$", line)
            if item and current:
                current["items"].append({
                    "label": item.group(2).strip(),
                    "done": item.group(1).lower() == "x",
                })

        if current:
            current["completed"] = bool(current["items"]) and all(i["done"] for i in current["items"])
            milestones.append(current)

        if not milestones:
            raise ValueError("no milestones parsed")

        MILESTONE_CACHE["mtime"] = mtime
        MILESTONE_CACHE["data"] = milestones
        return milestones
    except Exception:
        return MILESTONE_CACHE["data"] or fallback_milestones()


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
