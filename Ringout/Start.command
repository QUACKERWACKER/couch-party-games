#!/bin/bash
exec "$(dirname -- "$0")/../Play.command" --joinstick http://127.0.0.1:3000 "$@"
