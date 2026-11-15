#!/usr/bin/env python3
"""Local writer for the unpublished y2k preview's data/about.json.

Binds only to 127.0.0.1:1316 so it cannot be reached from the network.
Does not talk to GitHub or the production Worker.
"""
from __future__ import annotations

import json
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

HOST = "127.0.0.1"
PORT = 1316
ROOT = Path(__file__).resolve().parent.parent
ABOUT = ROOT / "data" / "about.json"
MAX_BODY = 256 * 1024

SCALAR_KEYS = (
    "name_zh",
    "name_en",
    "email",
    "email_alt",
    "location_zh",
    "location_en",
    "portrait",
    "bio",
)
EDU_KEYS = ("org", "detail", "when")
PROJECT_KEYS = ("author", "title", "subtitle", "source", "when", "url", "note")
PAPER_KEYS = ("author", "title", "source", "when", "url")


def origin_ok(origin: str) -> bool:
    if not origin:
        return True
    return origin.startswith("http://127.0.0.1:") or origin.startswith("http://localhost:")


def text(s) -> str:
    if s is None:
        return ""
    return str(s)


def clean_list(raw, keys):
    if not isinstance(raw, list):
        return []
    out = []
    for item in raw:
        if not isinstance(item, dict):
            continue
        row = {k: text(item.get(k)).strip() for k in keys}
        if any(row.values()):
            out.append(row)
    return out


def normalize(payload):
    if not isinstance(payload, dict):
        raise ValueError("body must be an object")
    src = payload.get("about", payload)
    if not isinstance(src, dict):
        raise ValueError("about must be an object")
    about = {k: text(src.get(k)).strip() if k != "bio" else text(src.get(k)).replace("\r\n", "\n") for k in SCALAR_KEYS}
    about["sample"] = bool(src.get("sample"))
    about["education"] = clean_list(src.get("education"), EDU_KEYS)
    about["projects"] = clean_list(src.get("projects"), PROJECT_KEYS)
    about["papers"] = clean_list(src.get("papers"), PAPER_KEYS)
    return about


def dumps(obj) -> bytes:
    return (json.dumps(obj, ensure_ascii=False, indent=2) + "\n").encode("utf-8")


def load_about():
    if not ABOUT.is_file():
        raise FileNotFoundError("data/about.json is missing")
    return json.loads(ABOUT.read_text(encoding="utf-8"))


def save_about(about):
    ABOUT.parent.mkdir(parents=True, exist_ok=True)
    tmp = ABOUT.with_name("about.json.tmp")
    tmp.write_bytes(dumps(about))
    tmp.replace(ABOUT)


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        sys.stderr.write("%s - %s\n" % (self.address_string(), fmt % args))

    def _cors(self):
        origin = self.headers.get("Origin", "")
        if origin_ok(origin) and origin:
            self.send_header("Access-Control-Allow-Origin", origin)
            self.send_header("Vary", "Origin")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def _send(self, code, obj, content_type="application/json; charset=utf-8"):
        body = dumps(obj) if not isinstance(obj, (bytes, bytearray)) else obj
        self.send_response(code)
        self._cors()
        self.send_header("Content-Type", content_type)
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors()
        self.end_headers()

    def do_GET(self):
        path = self.path.split("?", 1)[0]
        if path in ("/api/health", "/health"):
            self._send(200, {"ok": True, "file": str(ABOUT)})
            return
        if path == "/api/about":
            try:
                self._send(200, {"about": load_about()})
            except Exception as e:
                self._send(500, {"error": str(e)})
            return
        self._send(404, {"error": "not found"})

    def do_POST(self):
        path = self.path.split("?", 1)[0]
        if path != "/api/about":
            self._send(404, {"error": "not found"})
            return
        try:
            length = int(self.headers.get("Content-Length") or "0")
        except ValueError:
            self._send(400, {"error": "bad content length"})
            return
        if length > MAX_BODY:
            self._send(413, {"error": "payload too large"})
            return
        raw = self.rfile.read(length) if length else b"{}"
        try:
            payload = json.loads(raw.decode("utf-8"))
            about = normalize(payload)
            save_about(about)
        except ValueError as e:
            self._send(400, {"error": str(e)})
            return
        except Exception as e:
            self._send(500, {"error": str(e)})
            return
        self._send(200, {"ok": True, "about": about})


def main():
    if not ABOUT.is_file():
        sys.stderr.write("missing %s\n" % ABOUT)
        sys.exit(1)
    server = ThreadingHTTPServer((HOST, PORT), Handler)
    sys.stderr.write("local about admin on http://%s:%s  (writing %s)\n" % (HOST, PORT, ABOUT))
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        sys.stderr.write("\nstopped\n")


if __name__ == "__main__":
    main()
