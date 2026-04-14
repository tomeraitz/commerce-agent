#!/usr/bin/env bash
# Interactive chat client for the AI Shopping Copilot.
# Assumes the server is already running (start it with `server/run.sh`).
# Ctrl-C or `exit` to quit.

set -u

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER_DIR="$SCRIPT_DIR/server"
HOST="${HOST:-127.0.0.1}"
PORT="${PORT:-8000}"
BASE_URL="${BASE_URL:-http://$HOST:$PORT}"
SESSION_ID="cli-$(date +%s)-$$"

command -v curl >/dev/null 2>&1 || { echo "curl is required" >&2; exit 1; }

# Pick a python for JSON helpers: prefer the server's venv, then PATH.
if [ -x "$SERVER_DIR/.venv/Scripts/python.exe" ]; then
  PY_CMD="$SERVER_DIR/.venv/Scripts/python.exe"
elif [ -x "$SERVER_DIR/.venv/bin/python" ]; then
  PY_CMD="$SERVER_DIR/.venv/bin/python"
elif command -v python >/dev/null 2>&1; then
  PY_CMD="python"
elif command -v python3 >/dev/null 2>&1; then
  PY_CMD="python3"
else
  echo "python is required for JSON escaping" >&2
  exit 1
fi

if ! curl -sf "$BASE_URL/health" >/dev/null 2>&1; then
  echo "server is not reachable at $BASE_URL" >&2
  echo "start it first:  (cd server && ./run.sh)" >&2
  exit 1
fi

echo "connected to $BASE_URL. session=$SESSION_ID"
echo "type a question and press Enter. type 'exit' or Ctrl-C to quit."
echo ""

# Escape user text for JSON (handles quotes, backslashes, newlines, control chars).
json_escape() {
  "$PY_CMD" -c 'import json,sys; sys.stdout.write(json.dumps(sys.stdin.read()))'
}

# Pretty-print the response; fall back to raw JSON on parse failure.
format_response() {
  "$PY_CMD" - <<'PY' 2>/dev/null || cat
import json, sys
try:
    data = json.load(sys.stdin)
except Exception:
    sys.exit(1)
msg = data.get("message", "")
print(f"assistant: {msg}")
products = data.get("products") or []
if products:
    print(f"  products ({len(products)}):")
    for p in products[:10]:
        title = p.get("title") or p.get("name") or p.get("id", "?")
        price = p.get("price")
        line = f"    - {title}"
        if price is not None:
            line += f"  ${price}"
        print(line)
rec = data.get("recommendation")
if rec:
    print(f"  recommendation: {json.dumps(rec)}")
PY
}

while true; do
  printf "you> "
  if ! IFS= read -r line; then
    echo ""
    break
  fi
  [ -z "$line" ] && continue
  case "$line" in
    exit|quit|:q) break ;;
  esac

  msg_json=$(printf "%s" "$line" | json_escape)
  sid_json=$(printf "%s" "$SESSION_ID" | json_escape)
  payload="{\"sessionId\": $sid_json, \"message\": $msg_json}"

  response=$(curl -sS -X POST "$BASE_URL/chat" \
    -H "Content-Type: application/json" \
    -d "$payload")

  if [ -z "$response" ]; then
    echo "(no response from server)"
    continue
  fi

  printf "%s" "$response" | format_response
  echo ""
done
