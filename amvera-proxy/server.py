import html
import hashlib
import json
import os
import re
import sqlite3
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse


DB_PATH = os.environ.get("VOTES_DB", "/data/votes.db")
END_AT = "2026-11-21T20:59:00.000Z"
END_AT_DT = datetime.fromisoformat(END_AT.replace("Z", "+00:00"))
CALLBACK_RE = re.compile(r"^(?:window\.)?[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*$")


def connect():
    db = sqlite3.connect(DB_PATH, timeout=10)
    db.execute("PRAGMA journal_mode=WAL")
    db.execute("PRAGMA synchronous=FULL")
    db.execute("PRAGMA busy_timeout=10000")
    return db


def initialize():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    with connect() as db:
        db.execute("""
            CREATE TABLE IF NOT EXISTS votes (
                user_id TEXT PRIMARY KEY,
                nominee_id INTEGER NOT NULL CHECK(nominee_id BETWEEN 1 AND 50),
                updated_at TEXT NOT NULL
            )
        """)
        db.execute("CREATE INDEX IF NOT EXISTS votes_nominee_idx ON votes(nominee_id)")


def snapshot(user_id=""):
    with connect() as db:
        counts = {str(row[0]): row[1] for row in db.execute(
            "SELECT nominee_id, COUNT(*) FROM votes GROUP BY nominee_id"
        )}
        selected = None
        if user_id:
            row = db.execute("SELECT nominee_id FROM votes WHERE user_id = ?", (user_id,)).fetchone()
            selected = row[0] if row else None
    return {"ok": True, "counts": counts, "selected": selected, "endAt": END_AT}


def save_vote(user_id, nominee_id):
    if not user_id or len(user_id) > 200:
        raise ValueError("Invalid userId")
    nominee_id = int(nominee_id)
    if nominee_id < 1 or nominee_id > 50:
        raise ValueError("Invalid nomineeId")
    now_dt = datetime.now(timezone.utc)
    if now_dt > END_AT_DT:
        raise ValueError("Voting is closed")
    now = now_dt.isoformat(timespec="milliseconds").replace("+00:00", "Z")
    with connect() as db:
        db.execute("BEGIN IMMEDIATE")
        db.execute("""
            INSERT INTO votes(user_id, nominee_id, updated_at) VALUES (?, ?, ?)
            ON CONFLICT(user_id) DO UPDATE SET
                nominee_id = excluded.nominee_id,
                updated_at = excluded.updated_at
        """, (user_id, nominee_id, now))
        db.commit()
    voter_hash = hashlib.sha256(user_id.encode("utf-8")).hexdigest()[:12]
    print(f"VOTE SAVED voter={voter_hash} nominee={nominee_id} time={now}", flush=True)
    return snapshot(user_id)


class VotingServer(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def log_message(self, fmt, *args):
        print("%s - %s" % (self.address_string(), fmt % args), flush=True)

    def cors(self, cache="no-store"):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Accept")
        self.send_header("Cache-Control", cache)

    def do_OPTIONS(self):
        self.send_response(204)
        self.cors()
        self.send_header("Content-Length", "0")
        self.end_headers()

    def do_GET(self):
        parsed = urlparse(self.path)
        query = parse_qs(parsed.query)
        try:
            if parsed.path == "/api/health":
                self.json_reply(200, {"ok": True, "database": "amvera-sqlite", "endAt": END_AT})
            elif parsed.path == "/api/votes":
                self.json_reply(200, snapshot((query.get("userId") or [""])[0]))
            elif parsed.path == "/api/votes.js":
                callback = (query.get("callback") or [""])[0]
                if not CALLBACK_RE.fullmatch(callback):
                    self.json_reply(400, {"ok": False, "error": "Invalid callback"})
                    return
                payload = json.dumps(snapshot((query.get("userId") or [""])[0]), ensure_ascii=False, separators=(",", ":"))
                self.reply(200, f"{callback}({payload});".encode(), "application/javascript; charset=utf-8")
            else:
                self.json_reply(404, {"ok": False, "error": "Route not found"})
        except Exception as error:
            print("GET error:", repr(error), flush=True)
            self.json_reply(500, {"ok": False, "error": "Voting storage unavailable"})

    def do_POST(self):
        parsed = urlparse(self.path)
        length = int(self.headers.get("Content-Length", "0") or "0")
        if length > 8192:
            self.json_reply(413, {"ok": False, "error": "Request too large"})
            return
        raw = self.rfile.read(length) if length else b""
        content_type = self.headers.get("Content-Type", "")
        try:
            if "application/x-www-form-urlencoded" in content_type:
                form = parse_qs(raw.decode("utf-8"))
                data = {key: values[0] for key, values in form.items()}
            else:
                data = json.loads(raw.decode("utf-8") or "{}")
            if parsed.path == "/api/vote":
                self.json_reply(200, save_vote(str(data.get("userId", "")), data.get("nomineeId")))
            elif parsed.path == "/api/vote-form":
                result = save_vote(str(data.get("userId", "")), data.get("nomineeId"))
                request_id = str(data.get("requestId", ""))[:96]
                message = json.dumps({"source": "nasledie-voting", "requestId": request_id, "payload": result}, ensure_ascii=False)
                page = "<!doctype html><meta charset=utf-8><script>parent.postMessage(%s,'*')</script>" % json.dumps(message)
                self.reply(200, page.encode(), "text/html; charset=utf-8")
            else:
                self.json_reply(404, {"ok": False, "error": "Route not found"})
        except (ValueError, TypeError, json.JSONDecodeError) as error:
            self.json_reply(400, {"ok": False, "error": str(error)})
        except Exception as error:
            print("POST error:", repr(error), flush=True)
            self.json_reply(500, {"ok": False, "error": "Vote was not saved"})

    def json_reply(self, status, value):
        payload = json.dumps(value, ensure_ascii=False, separators=(",", ":")).encode()
        self.reply(status, payload)

    def reply(self, status, payload, content_type="application/json; charset=utf-8"):
        self.send_response(status)
        self.cors()
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(payload)


if __name__ == "__main__":
    initialize()
    port = int(os.environ.get("PORT", "80"))
    print("NASLEDIE voting storage listening on port", port, flush=True)
    ThreadingHTTPServer(("0.0.0.0", port), VotingServer).serve_forever()
