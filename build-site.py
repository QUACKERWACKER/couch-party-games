"""Build the public games from an explicit list of browser assets."""
import argparse
import json
from pathlib import Path
import re
from shutil import copyfile
from urllib.parse import urlsplit


ROOT = Path(__file__).resolve().parent
PAGES = {
    "Blitz 7/game": "game.js style.css",
    "Blitz Hoops": "game.js style.css",
    "Blitz Track": "events.js game.js style.css",
    "Bedrock": "game.js style.css",
    "Ringout": ("build-mode.js card-effects.js cards.js cosmetics.js floor-sprites.svg "
                "game.js kinetic.js maps.js pickups.svg sprites.svg style.css themes.js ui-sprites.svg"),
}
COVERS = ("blitz", "hoops", "track", "ringout", "bedrock")
NOINDEX = '<head>\n<meta name="robots" content="noindex">'


def build(output, relay):
    output.mkdir(parents=True)
    for folder, assets in {"": "", **PAGES}.items():
        destination = output / folder
        destination.mkdir(parents=True, exist_ok=True)
        html = (ROOT / folder / "index.html").read_text()
        html = html.replace("<head>", NOINDEX, 1)
        if not folder:
            html = html.replace('href="/', 'href="./')
        else:
            parent = "../" * len(Path(folder).parts)
            html = html.replace('src="/joinstick-host.js"', f'src="{parent}joinstick-host.js"')
            html = html.replace('href="/"', f'href="{parent}"')
        if folder == "Blitz 7/game":
            html = html.replace('<script src="qr-host.js" defer></script>\n', '')
            html = re.sub(r'  <details class="qr-controller".*?</details>\n', '', html, flags=re.S)
        (destination / "index.html").write_text(html)
        for asset in assets.split():
            copyfile(ROOT / folder / asset, destination / asset)

    covers = output / "covers"
    covers.mkdir()
    for game in COVERS:
        file = f"{game}.webp"
        copyfile(ROOT / "covers" / file, covers / file)

    source = ROOT / "phone-controllers/public/phone"
    copyfile(source / "profiles.js", output / "profiles.js")
    script = ""
    if relay:
        script = (f"const couchJoinstickServer = {json.dumps(relay)};\n"
                  "const couchJoinstickPublicUrl = null;\n"
                  "const couchJoinstickHostedPhone = true;\n"
                  + (ROOT / "joinstick-host.js").read_text())
        phone = output / "phone"
        phone.mkdir()
        html = (source / "index.html").read_text().replace("<head>", NOINDEX, 1)
        (phone / "index.html").write_text(html)
        copyfile(source / "pad.css", phone / "pad.css")
        copyfile(source / "profiles.js", phone / "profiles.js")
        (phone / "pad.js").write_text(f"const couchPhoneRelay = {json.dumps(relay)};\n"
                                      + (source / "pad.js").read_text())
    (output / "joinstick-host.js").write_text(script)
    (output / ".nojekyll").touch()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("output", type=Path)
    parser.add_argument("--relay", default="", help="Public HTTPS origin for Joinstick.")
    args = parser.parse_args()
    if args.relay:
        try:
            url = urlsplit(args.relay)
            if (url.scheme != "https" or not url.hostname or url.username is not None
                    or url.path not in ("", "/") or url.query or url.fragment or url.port == 0):
                raise ValueError
        except ValueError:
            parser.error("--relay must be an HTTPS origin with no credentials or path")
    if args.output.exists():
        parser.error("output directory already exists; choose a fresh folder")
    build(args.output, args.relay.rstrip("/"))
