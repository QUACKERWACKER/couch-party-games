#!/bin/bash
set -e
cd -- "$(dirname -- "$0")"
if command -v python3 >/dev/null && python3 -c 'import http.server' 2>/dev/null; then
  exec python3 serve.py "$@"
fi
printf 'Python 3 is required. Install it, then open Play.command again.\n' >&2
exit 1
