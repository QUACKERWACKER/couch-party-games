import argparse
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import json
from pathlib import Path
from urllib.parse import urlsplit
import webbrowser

from qr_controller import ControllerRoom, QRResponse


ROOT = Path(__file__).resolve().parent
GAMES = {"blitz": "/Blitz%207/game/", "ringout": "/Ringout/", "bedrock": "/Bedrock/", "hoops": "/Blitz%20Hoops/", "track": "/Blitz%20Track/"}
COVER_PATHS = {f"/covers/{game}.webp" for game in GAMES}
ASSET_TYPES = {".html", ".css", ".js", ".svg", ".png", ".jpg", ".webp", ".ico"}


class GameFiles(QRResponse, SimpleHTTPRequestHandler):
    def local_qr_request(self):
        return self.headers.get("Host", "").split(":")[0] in ("127.0.0.1", "localhost")

    def do_GET(self):
        room = self.server.room
        route = urlsplit(self.path).path
        if route == "/joinstick-host.js":
            self.reply(self.server.joinstick_script, kind="text/javascript; charset=utf-8")
        elif route in ("/profiles.js", "/direct-link.js"):
            self.reply((ROOT / "phone-controllers/public" / ("phone" + route)).read_bytes(), kind="text/javascript; charset=utf-8")
        elif route.startswith("/qr/host") and not self.local_qr_request():
            self.reply({}, 404)
        elif route == "/qr/host":
            self.reply({"url": room.url})
        elif route == "/qr/host/image":
            if room.image:
                self.reply(room.image, kind="image/png")
            else:
                self.reply({}, 404)
        else:
            super().do_GET()

    def do_POST(self):
        room = self.server.room
        route = urlsplit(self.path).path
        if not self.local_qr_request():
            self.reply({}, 404)
            return
        try:
            body = self.json_body()
            if route == "/qr/host/pads":
                self.reply(room.hostpoll(body))
            elif route == "/qr/host/kick" and type(body.get("index")) is int:
                room.kick(body["index"])
                self.reply({})
            else:
                self.reply({}, 404)
        except (ValueError, TypeError):
            self.reply({}, 400)

    def send_head(self):
        url_path = urlsplit(self.path).path
        path = Path(self.translate_path(url_path)).resolve()
        if url_path not in ("/", "/index.html", "/grid-navigation.js", "/game-runtime.js") and url_path not in COVER_PATHS and not any(
            url_path.startswith(route)
            and (path == folder or (folder in path.parents and path.suffix in ASSET_TYPES))
            for route in GAMES.values()
            for folder in (Path(self.translate_path(route)).resolve(),)
        ):
            self.send_error(404)
            return None
        return super().send_head()

    def list_directory(self, path):
        self.send_error(404)
        return None

    def log_message(self, *_args):
        pass


def main():
    parser = argparse.ArgumentParser(description="Launch Couch Party Games on this Mac.")
    parser.add_argument("--game", choices=GAMES, help="Open a game directly.")
    parser.add_argument("--port", type=int, default=8277, help="Local port (0 picks a free port).")
    parser.add_argument("--no-open", action="store_true", help="Print the URL without opening it.")
    parser.add_argument("--joinstick", metavar="URL",
                        help="Enable optional phone controllers using a trusted Joinstick server.")
    parser.add_argument("--joinstick-public-url", metavar="HTTPS_URL",
                        help="Public phone invite origin for a locally connected Joinstick relay.")
    args = parser.parse_args()

    joinstick_script = b""
    if args.joinstick:
        try:
            url = urlsplit(args.joinstick)
            loopback = url.hostname in ("localhost", "127.0.0.1", "::1")
            if (not url.hostname or url.username is not None or url.path not in ("", "/")
                    or url.query or url.fragment or url.port == 0
                    or (url.scheme != "https" and not (url.scheme == "http" and loopback))):
                raise ValueError
        except ValueError:
            parser.error("--joinstick needs an HTTPS origin or a local URL such as http://localhost:3000")
        config = json.dumps(f"{url.scheme}://{url.netloc}")
        public_config = "null"
        if args.joinstick_public_url:
            try:
                public = urlsplit(args.joinstick_public_url)
                if (public.scheme != "https" or not public.hostname or public.username is not None
                        or public.path not in ("", "/") or public.query or public.fragment or public.port == 0):
                    raise ValueError
            except ValueError:
                parser.error("--joinstick-public-url needs a public HTTPS origin")
            public_config = json.dumps(f"https://{public.netloc}")
        joinstick_script = (f"const couchJoinstickServer = {config};\n"
                            f"const couchJoinstickPublicUrl = {public_config};\n".encode()
                            + (ROOT / "joinstick-host.js").read_bytes())
    elif args.joinstick_public_url:
        parser.error("--joinstick-public-url also needs --joinstick")

    handler = partial(GameFiles, directory=ROOT)
    try:
        server = ThreadingHTTPServer(("127.0.0.1", args.port), handler)
    except OSError as error:
        parser.exit(1, f"Could not start Couch Party Games on port {args.port}: {error}\n"
                       "Close an earlier launcher or run Play.command --port 0.\n")

    room = ControllerRoom()
    server.room = room
    server.joinstick_script = joinstick_script
    if args.game in (None, "blitz"):
        room.start()
    with server:
        url = f"http://127.0.0.1:{server.server_port}{GAMES.get(args.game, '/')}"
        print(f"Couch Party Games  •  {url}\nKeep this window open while playing. Press Control-C to stop.",
              flush=True)
        if not args.no_open:
            webbrowser.open(url)
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            pass
        finally:
            room.close()


if __name__ == "__main__":
    main()
