#!/usr/bin/env bash
set -euo pipefail

PORT="${PORT:-4173}"
BASE_URL="http://127.0.0.1:${PORT}"
ROOT_DOM_OUTPUT="$(mktemp)"
WEB_DOM_OUTPUT="$(mktemp)"
SERVER_LOG="$(mktemp)"

cleanup() {
    if [[ -n "${SERVER_PID:-}" ]]; then kill "${SERVER_PID}" 2>/dev/null || true; fi
    rm -f "${ROOT_DOM_OUTPUT}" "${WEB_DOM_OUTPUT}" "${SERVER_LOG}"
}
trap cleanup EXIT

python3 -m http.server "${PORT}" --bind 127.0.0.1 --directory . >"${SERVER_LOG}" 2>&1 &
SERVER_PID=$!
for _ in {1..30}; do
    if curl --fail --silent "${BASE_URL}/index.html" >/dev/null; then break; fi
    sleep 0.2
done
for path in index.html web/index.html web/shaders/block.vert.glsl web/shaders/block.frag.glsl; do
    curl --fail --silent "${BASE_URL}/${path}" >/dev/null
done

BROWSER=""
for candidate in google-chrome google-chrome-stable chromium chromium-browser; do
    if command -v "${candidate}" >/dev/null 2>&1; then BROWSER="${candidate}"; break; fi
done
if [[ -z "${BROWSER}" ]]; then
    echo "No supported Chromium-based browser was found." >&2
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
        --virtual-time-budget=7000 \
        --dump-dom \
        "${url}" >"${output}"

    grep -q 'data-app-state="running"' "${output}"
    grep -q 'data-webgl="2"' "${output}"
    grep -q 'data-phase="3"' "${output}"
    grep -q 'data-draw-calls="1"' "${output}"
    grep -q 'data-gl-errors="0"' "${output}"
    grep -q 'data-geometry="visible"' "${output}"
    grep -q 'data-chunk-count="1"' "${output}"
    grep -q 'data-chunk-faces="1220"' "${output}"
}

run_browser_check "${BASE_URL}/" "${ROOT_DOM_OUTPUT}"
run_browser_check "${BASE_URL}/web/" "${WEB_DOM_OUTPUT}"
echo "Root and web-directory Phase 3 chunk smoke tests passed."
