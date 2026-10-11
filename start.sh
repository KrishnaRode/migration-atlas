#!/usr/bin/env bash
# Migration Atlas — one-command local start (macOS / Linux).
#   ./start.sh            install what's missing, then run backend + web
#   API_PORT=8020 WEB_PORT=3020 ./start.sh
#   ATLAS_PULL_MODEL=1 ./start.sh   also pull the default local model if none is installed
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
API_PORT="${API_PORT:-8014}"
WEB_PORT="${WEB_PORT:-3014}"
MODEL="${ATLAS_DEFAULT_MODEL:-qwen3:4b}"
BOLD=$'\e[1m'; DIM=$'\e[2m'; GREEN=$'\e[32m'; YELLOW=$'\e[33m'; RED=$'\e[31m'; RESET=$'\e[0m'

say()  { printf "%s▸%s %s\n" "$BOLD" "$RESET" "$*"; }
ok()   { printf "  %s✓%s %s\n" "$GREEN" "$RESET" "$*"; }
warn() { printf "  %s!%s %s\n" "$YELLOW" "$RESET" "$*"; }
die()  { printf "  %s✗%s %s\n" "$RED" "$RESET" "$*"; exit 1; }

printf "\n%sMigration Atlas%s %s· local AI migration architecture studio%s\n\n" "$BOLD" "$RESET" "$DIM" "$RESET"

# ---------------------------------------------------------------- prerequisites
say "Checking prerequisites"
PY=""
for candidate in python3.12 python3.13 python3.11 python3.10 python3; do
  if command -v "$candidate" >/dev/null 2>&1 && "$candidate" -c 'import sys; sys.exit(0 if (3,10) <= sys.version_info[:2] < (3,15) else 1)' 2>/dev/null; then
    PY="$candidate"; break
  fi
done
[ -n "$PY" ] || die "Python 3.10–3.14 is required (https://www.python.org/downloads/)."
ok "Python: $($PY --version)"
command -v node >/dev/null 2>&1 || die "Node.js 18.18+ is required (https://nodejs.org)."
node -e 'const [a,b]=process.versions.node.split(".").map(Number); process.exit(a>18||(a===18&&b>=18)?0:1)' || die "Node.js 18.18+ is required (found $(node -v))."
ok "Node: $(node -v)"

if command -v ollama >/dev/null 2>&1; then
  if ! curl -fsS "http://127.0.0.1:11434/api/version" >/dev/null 2>&1; then
    say "Starting Ollama"
    (ollama serve >/dev/null 2>&1 &) ; sleep 2
  fi
  if curl -fsS "http://127.0.0.1:11434/api/tags" | grep -q '"name"'; then
    ok "Ollama is running with installed models"
  elif [ "${ATLAS_PULL_MODEL:-0}" = "1" ]; then
    say "Pulling $MODEL (one-time download)"; ollama pull "$MODEL"
  else
    warn "Ollama has no models. Run: ollama pull $MODEL   (the app still works without AI; AI features show setup steps)"
  fi
else
  warn "Ollama not found — install from https://ollama.com/download for AI features. Rules, validation and exports work without it."
fi

# ---------------------------------------------------------------- install
say "Installing backend"
cd "$ROOT/apps/backend"
if [ ! -x .venv/bin/python ]; then
  if command -v uv >/dev/null 2>&1; then uv venv --python "$PY" .venv -q; else "$PY" -m venv .venv; fi
fi
if ! .venv/bin/python -c 'import fastapi, networkx, reportlab' 2>/dev/null; then
  if command -v uv >/dev/null 2>&1; then VIRTUAL_ENV=.venv uv pip install -q -e ".[dev]"; else .venv/bin/python -m pip install -q -e ".[dev]"; fi
fi
ok "Backend dependencies ready"

say "Installing web app"
cd "$ROOT/apps/web"
[ -d node_modules ] || npm install --no-audit --no-fund --loglevel=error
ok "Web dependencies ready"

# ---------------------------------------------------------------- run
port_busy() { (exec 3<>"/dev/tcp/127.0.0.1/$1") 2>/dev/null; }
port_busy "$API_PORT" && die "Port $API_PORT is in use. Try: API_PORT=8020 ./start.sh"
port_busy "$WEB_PORT" && die "Port $WEB_PORT is in use. Try: WEB_PORT=3020 ./start.sh"

PIDS=()
cleanup() { printf "\n"; say "Stopping"; for p in "${PIDS[@]:-}"; do kill "$p" 2>/dev/null || true; done; }
trap cleanup EXIT INT TERM

say "Starting API on :$API_PORT"
cd "$ROOT/apps/backend"
ATLAS_CORS_ORIGINS="http://localhost:$WEB_PORT,http://127.0.0.1:$WEB_PORT" \
  .venv/bin/python -m uvicorn atlas.main:app --host 127.0.0.1 --port "$API_PORT" --log-level warning &
PIDS+=($!)

say "Starting web on :$WEB_PORT"
cd "$ROOT/apps/web"
NEXT_PUBLIC_API_URL="http://127.0.0.1:$API_PORT" WEB_PORT="$WEB_PORT" npm run dev --silent &
PIDS+=($!)

for _ in $(seq 1 60); do curl -fsS "http://127.0.0.1:$API_PORT/health" >/dev/null 2>&1 && break; sleep 1; done
URL="http://localhost:$WEB_PORT"
printf "\n  %sMigration Atlas is running →%s %s\n  %sArchitecture data stays on this machine. Ctrl-C to stop.%s\n\n" "$GREEN" "$RESET" "$URL" "$DIM" "$RESET"
if [ "${ATLAS_NO_BROWSER:-0}" != "1" ]; then
  (sleep 4; command -v open >/dev/null && open "$URL" || command -v xdg-open >/dev/null && xdg-open "$URL") >/dev/null 2>&1 &
fi
wait
