#!/usr/bin/env bash
set -euo pipefail

PORT="${PORT:-4173}"
BASE_URL="http://127.0.0.1:${PORT}"
DOM_OUTPUT="$(mktemp)"
SERVER_LOG="$(mktemp)"

cleanup() {
    if [[ -n "${SERVER_PID:-}" ]]; then
        kill "${SERVER_PID}" 2>/dev/null || true
    fi
    rm -f "${DOM_OUTPUT}" "${SERVER_LOG}"
}
trap cleanup EXIT

python3 -m http.server "${PORT}" --bind 127.0.0.1 --directory web >"${SERVER_LOG}" 2>&1 &
SERVER_PID=$!

for _ in {1..30}; do
    if curl --fail --silent "${BASE_URL}/index.html" >/dev/null; then
        break
    fi
    sleep 0.2
done
curl --fail --silent "${BASE_URL}/index.html" >/dev/null

BROWSER=""
for candidate in google-chrome google-chrome-stable chromium chromium-browser; do
    if command -v "${candidate}" >/dev/null 2>&1; then
        BROWSER="${candidate}"
        break
    fi
done

if [[ -z "${BROWSER}" ]]; then
    echo "No supported Chromium-based browser was found for the smoke test." >&2
    exit 1
fi

"${BROWSER}" \
    --headless=new \
    --no-sandbox \
    --disable-dev-shm-usage \
    --ignore-gpu-blocklist \
    --enable-webgl \
    --use-angle=swiftshader \
    --enable-unsafe-swiftshader \
    --virtual-time-budget=3000 \
    --dump-dom \
    "${BASE_URL}/" >"${DOM_OUTPUT}"

grep -q 'data-app-state="running"' "${DOM_OUTPUT}"
grep -q 'data-webgl="2"' "${DOM_OUTPUT}"

echo "Browser WebGL 2 smoke test passed."
