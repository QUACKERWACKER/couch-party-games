"""Local Wi-Fi input bridge for the Blitz 7 phone controller."""
from collections import deque
from dataclasses import dataclass, field
from functools import cached_property
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import ipaddress
import json
import math
from pathlib import Path
import secrets
import socket
import subprocess
from threading import Lock, Thread
from time import monotonic
from urllib.parse import urlsplit

from qr_code import png_qr


PHONE_FILES = {"": ("index.html", "text/html"), "pad.css": ("pad.css", "text/css"),
               "pad.js": ("pad.js", "text/javascript")}
FILES = Path(__file__).resolve().parent / "Blitz 7" / "game" / "controller"


def wifi_address():
    for interface in ("en0", "en1", "en2"):
        try:
            value = subprocess.check_output(
                ["/usr/sbin/ipconfig", "getifaddr", interface],
                text=True, stderr=subprocess.DEVNULL, timeout=2).strip()
            if not ipaddress.IPv4Address(value).is_loopback:
                return value
        except (OSError, ValueError, subprocess.SubprocessError):
            pass
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as route:
            route.connect(("192.0.2.1", 9))
            value = route.getsockname()[0]
            if not ipaddress.IPv4Address(value).is_loopback:
                return value
    except (OSError, ValueError):
        pass
    return None


@dataclass
class Phone:
    index: int
    seen: float = field(default_factory=monotonic)
    axes: tuple = (0, 0)
    mask: int = 0
    events: deque = field(default_factory=lambda: deque([(0, 0, 1), (0, 0, 0)], maxlen=48))
    label: dict = field(default_factory=dict)


class ControllerRoom:
    def __init__(self):
        self.code = secrets.token_urlsafe(12)
        self.phones = {}
        self.next_index = 1000
        self.lock = Lock()
        self.url = None
        self.server = None
        self.open_slots = 14

    def start(self):
        address = wifi_address()
        if address is None:
            return
        try:
            self.server = ThreadingHTTPServer((address, 0), PhoneHandler)
        except OSError:
            return
        self.server.room = self
        self.url = f"http://{address}:{self.server.server_port}/{self.code}/"
        Thread(target=self.server.serve_forever, daemon=True).start()

    def close(self):
        if self.server:
            self.server.shutdown()
            self.server.server_close()

    @cached_property
    def image(self):
        if not self.url:
            return b""
        return png_qr(self.url)

    def prune(self, now):
        for token in list(self.phones):
            if now - self.phones[token].seen > 3.5:
                del self.phones[token]

    def join(self):
        with self.lock:
            self.prune(monotonic())
            pending = sum(not phone.label for phone in self.phones.values())
            if len(self.phones) >= 14 or pending >= self.open_slots:
                return None
            token = secrets.token_urlsafe(18)
            self.phones[token] = Phone(self.next_index)
            self.next_index += 1
            return {"token": token}

    def input(self, token, current, events):
        with self.lock:
            phone = self.phones.get(token)
            if phone is None:
                return None
            phone.seen = monotonic()
            phone.axes = current[:2]
            phone.mask = current[2]
            phone.events.extend(events)
            return phone.label

    def kick(self, index):
        with self.lock:
            for token, phone in list(self.phones.items()):
                if phone.index == index:
                    del self.phones[token]

    def hostpoll(self, labels):
        now = monotonic()
        with self.lock:
            self.prune(now)
            slots = labels.get("_open", 14)
            self.open_slots = max(0, min(14, slots)) if type(slots) is int else 14
            pads = []
            for phone in self.phones.values():
                phone.label = labels.get(str(phone.index), {})
                if now - phone.seen > .8:
                    phone.events.clear()
                    phone.axes = (0, 0)
                    phone.mask = 0
                pads.append({"index": phone.index, "axes": phone.axes, "mask": phone.mask,
                             "events": list(phone.events)})
                phone.events.clear()
            return pads


def input_state(value):
    if not isinstance(value, list) or len(value) != 3:
        raise ValueError
    x, y, mask = value
    if not all(type(n) in (int, float) and math.isfinite(n) and -1 <= n <= 1 for n in (x, y)):
        raise ValueError
    if type(mask) is not int or not 0 <= mask <= 63:
        raise ValueError
    return (x, y, mask)


class QRResponse:
    def reply(self, content, status=200, kind="application/json"):
        if kind == "application/json":
            content = json.dumps(content, separators=(",", ":")).encode()
        self.send_response(status)
        self.send_header("Content-Type", kind)
        self.send_header("Content-Length", str(len(content)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("Referrer-Policy", "no-referrer")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.end_headers()
        self.wfile.write(content)

    def json_body(self):
        origin = self.headers.get("Origin")
        if origin and origin != "http://" + self.headers.get("Host", ""):
            raise ValueError
        if self.headers.get_content_type() != "application/json":
            raise ValueError
        size = int(self.headers.get("Content-Length", "0"))
        if not 0 < size <= 8192:
            raise ValueError
        body = json.loads(self.rfile.read(size))
        if not isinstance(body, dict):
            raise ValueError
        return body


class PhoneHandler(QRResponse, BaseHTTPRequestHandler):
    def log_message(self, *_args):
        pass

    def route(self):
        prefix = f"/{self.server.room.code}/"
        path = urlsplit(self.path).path
        return path[len(prefix):] if path.startswith(prefix) else None

    def do_GET(self):
        route = PHONE_FILES.get(self.route())
        if not route:
            self.reply({}, 404)
            return
        file, mime = route
        self.reply((FILES / file).read_bytes(), kind=mime + "; charset=utf-8")

    def do_POST(self):
        room = self.server.room
        route = self.route()
        try:
            body = self.json_body()
            if route == "join":
                entry = room.join()
                self.reply(entry or {"error": "The room is full."}, 200 if entry else 409)
            elif route == "input":
                token = body.get("token")
                changes = body.get("events", [])
                if not isinstance(token, str) or not isinstance(changes, list) or len(changes) > 48:
                    raise ValueError
                result = room.input(token, input_state(body.get("state")), [input_state(v) for v in changes])
                self.reply(result or {}, 200 if result is not None else 410)
            else:
                self.reply({}, 404)
        except (ValueError, TypeError, OverflowError):
            self.reply({}, 400)
