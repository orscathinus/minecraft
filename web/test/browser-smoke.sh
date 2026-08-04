#!/usr/bin/env bash
set -euo pipefail

PORT="${PORT:-4173}"
BASE_URL="http://127.0.0.1:${PORT}"
ROOT_DOM_OUTPUT="$(mktemp)"
WEB_DOM_OUTPUT="$(mktemp)"
SERVER_LOG="$(mktemp)"

cleanup() {
    if [[ -n "${SERVER_PID:-}" ]]; then
        kill "${SERVER_PID}" 2>/dev/null || true
    fi
    rm -f "${ROOT_DOM_OUTPUT}" "${WEB_DOM_OUTPUT}" "${SERVER_LOG}"
}
trap cleanup EXIT

# Serve the repository root so the test matches branch-based GitHub Pages.
python3 -m http.server "${PORT}" --bind 127.0.0.1 --directory . >"${SERVER_LOG}" 2>&1 &
SERVER_PID=$!

for _ in {1..30}; do
    if curl --fail --silent "${BASE_URL}/index.html" >/dev/null; then
        break
    fi
    sleep 0.2
done
curl --fail --silent "${BASE_URL}/index.html" >/dev/null
curl --fail --silent "${BASE_URL}/web/index.html" >/dev/null

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

run_browser_check() {
    local url="$1"
    local output="$2"

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
        "${url}" >"${output}"

    grep -q 'data-app-state="running"' "${output}"
    grep -q 'data-webgl="2"' "${output}"
}

run_browser_check "${BASE_URL}/" "${ROOT_DOM_OUTPUT}"
run_browser_check "${BASE_URL}/web/" "${WEB_DOM_OUTPUT}"

echo "Root and web-directory WebGL 2 smoke tests passed."
