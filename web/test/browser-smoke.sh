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

assert_dom() {
    local pattern="$1"
    local output="$2"
    if ! grep -q "${pattern}" "${output}"; then
        echo "Missing expected DOM pattern: ${pattern}" >&2
        cat "${output}" >&2
        exit 1
    fi
}

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
        --virtual-time-budget=30000 \
        --dump-dom \
        "${url}" >"${output}"

    assert_dom 'data-app-state="running"' "${output}"
    assert_dom 'data-webgl="2"' "${output}"
    assert_dom 'data-phase="4"' "${output}"
    assert_dom 'data-draw-calls="1"' "${output}"
    assert_dom 'data-gl-errors="0"' "${output}"
    assert_dom 'data-geometry="visible"' "${output}"
    assert_dom 'data-chunk-count="256"' "${output}"
    assert_dom 'data-world-faces="197256"' "${output}"
    assert_dom 'data-world-bounds="0-255,0-63,0-255"' "${output}"
    assert_dom 'data-terrain-range="57-63"' "${output}"
    assert_dom 'data-actual-terrain-range="58-62"' "${output}"
    assert_dom 'data-seed="1337"' "${output}"
}

run_browser_check "${BASE_URL}/" "${ROOT_DOM_OUTPUT}"
run_browser_check "${BASE_URL}/web/" "${WEB_DOM_OUTPUT}"
echo "Root and web-directory Phase 4 finite-world smoke tests passed."
