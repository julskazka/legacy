import os
import urllib.error
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer


UPSTREAM = os.environ.get(
    "UPSTREAM",
    "https://nasledie-voting.gogina-jul.workers.dev",
).rstrip("/")
ALLOWED_PATHS = {
    "/api/health",
    "/api/votes",
    "/api/votes.js",
    "/api/vote",
    "/api/vote-form",
}


class VotingProxy(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def log_message(self, fmt, *args):
        print("%s - %s" % (self.address_string(), fmt % args), flush=True)

    def send_cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Accept")
        self.send_header("Cache-Control", "no-store")

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_cors()
        self.send_header("Content-Length", "0")
        self.end_headers()

    def do_GET(self):
        self.proxy()

    def do_POST(self):
        self.proxy()

    def proxy(self):
        path = self.path.split("?", 1)[0].rstrip("/") or "/"
        if path not in ALLOWED_PATHS:
            self.reply(404, b'{"ok":false,"error":"Route not found"}')
            return

        length = int(self.headers.get("Content-Length", "0") or "0")
        if length > 4096:
            self.reply(413, b'{"ok":false,"error":"Request too large"}')
            return

        body = self.rfile.read(length) if length else None
        headers = {
            "Accept": self.headers.get("Accept", "*/*"),
            "User-Agent": "Nasledie-Amvera-Proxy/1.0",
        }
        if self.headers.get("Content-Type"):
            headers["Content-Type"] = self.headers["Content-Type"]

        request = urllib.request.Request(
            UPSTREAM + self.path,
            data=body,
            headers=headers,
            method=self.command,
        )

        try:
            with urllib.request.urlopen(request, timeout=8) as upstream:
                payload = upstream.read()
                self.reply(
                    upstream.status,
                    payload,
                    upstream.headers.get("Content-Type", "application/json; charset=utf-8"),
                )
        except urllib.error.HTTPError as error:
            payload = error.read()
            self.reply(
                error.code,
                payload,
                error.headers.get("Content-Type", "application/json; charset=utf-8"),
            )
        except Exception as error:
            print("Upstream error:", repr(error), flush=True)
            self.reply(502, b'{"ok":false,"error":"Voting storage unavailable"}')

    def reply(self, status, payload, content_type="application/json; charset=utf-8"):
        self.send_response(status)
        self.send_cors()
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(payload)


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "80"))
    print("NASLEDIE voting proxy listening on port", port, flush=True)
    ThreadingHTTPServer(("0.0.0.0", port), VotingProxy).serve_forever()
