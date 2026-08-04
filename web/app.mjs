import { FixedStepTimer } from "./fixed-step-timer.mjs";

const SKY_RED = 127 / 255;
const SKY_GREEN = 204 / 255;
const SKY_BLUE = 1;
const MAX_DEVICE_PIXEL_RATIO = 2;

class BrowserGame {
    #canvas;
    #status;
    #gl;
    #timer = new FixedStepTimer({
        updatesPerSecond: 60,
        maxFrameDeltaSeconds: 0.25,
        maxUpdatesPerFrame: 5,
    });
    #animationFrame = 0;
    #running = false;
    #resizeObserver = null;

    constructor(canvas, status) {
        this.#canvas = canvas;
        this.#status = status;

        const gl = canvas.getContext("webgl2", {
            alpha: false,
            antialias: false,
            depth: true,
            preserveDrawingBuffer: false,
            powerPreference: "high-performance",
        });
        if (!gl) {
            throw new Error(
                "WebGL 2 is unavailable. Use a current browser with hardware acceleration enabled.",
            );
        }
        this.#gl = gl;
    }

    start() {
        console.info("Starting Cave Game browser foundation.");
        console.info("WebGL version:", this.#gl.getParameter(this.#gl.VERSION));
        console.info("WebGL renderer:", this.#gl.getParameter(this.#gl.RENDERER));
        console.info("Frame synchronization: requestAnimationFrame");

        this.#gl.clearColor(SKY_RED, SKY_GREEN, SKY_BLUE, 1);
        this.#installListeners();
        this.#resize();

        this.#running = true;
        this.#timer.reset(performance.now());
        this.#animationFrame = requestAnimationFrame(this.#frame);
    }

    stop(message = "Application stopped. Reload the page to restart.") {
        if (!this.#running) {
            return;
        }

        this.#running = false;
        cancelAnimationFrame(this.#animationFrame);
        this.#animationFrame = 0;
        this.#status.textContent = message;
        this.#status.hidden = false;
        document.documentElement.dataset.appState = "stopped";
        console.info("Cave Game browser foundation stopped cleanly.");
    }

    close() {
        if (this.#running) {
            this.stop();
        }
        this.#resizeObserver?.disconnect();
        this.#resizeObserver = null;
    }

    #frame = (timestampMilliseconds) => {
        if (!this.#running) {
            return;
        }

        const frame = this.#timer.advance(timestampMilliseconds);
        for (let index = 0; index < frame.updateCount; index += 1) {
            this.#update(this.#timer.stepSeconds);
        }

        this.#render(frame.interpolationAlpha);
        this.#animationFrame = requestAnimationFrame(this.#frame);
    };

    #update(stepSeconds) {
        if (!(stepSeconds > 0)) {
            throw new Error("Fixed update duration must be positive");
        }
        // Gameplay simulation begins in later phases.
    }

    #render(interpolationAlpha) {
        if (interpolationAlpha < 0 || interpolationAlpha >= 1) {
            throw new Error("Interpolation alpha must be in [0, 1)");
        }

        this.#resize();
        this.#gl.clear(this.#gl.COLOR_BUFFER_BIT | this.#gl.DEPTH_BUFFER_BIT);

        if (this.#status.hidden === false) {
            this.#status.hidden = true;
        }
        document.documentElement.dataset.appState = "running";
        document.documentElement.dataset.webgl = "2";
    }

    #resize() {
        const pixelRatio = Math.min(
            Math.max(window.devicePixelRatio || 1, 1),
            MAX_DEVICE_PIXEL_RATIO,
        );
        const width = Math.max(1, Math.round(this.#canvas.clientWidth * pixelRatio));
        const height = Math.max(1, Math.round(this.#canvas.clientHeight * pixelRatio));

        if (this.#canvas.width !== width || this.#canvas.height !== height) {
            this.#canvas.width = width;
            this.#canvas.height = height;
            this.#gl.viewport(0, 0, width, height);
        }
    }

    #installListeners() {
        window.addEventListener("keydown", (event) => {
            if (event.code === "Escape") {
                event.preventDefault();
                this.stop(
                    "Application stopped. Browsers do not allow a page to close its own tab; close this tab or reload to restart.",
                );
            }
        });

        document.addEventListener("visibilitychange", () => {
            if (!document.hidden && this.#running) {
                this.#timer.reset(performance.now());
            }
        });

        this.#canvas.addEventListener("webglcontextlost", (event) => {
            event.preventDefault();
            this.stop("The WebGL context was lost. Reload the page to restart.");
        });

        window.addEventListener("pagehide", () => this.close(), { once: true });
        window.addEventListener("resize", () => this.#resize());

        if ("ResizeObserver" in window) {
            this.#resizeObserver = new ResizeObserver(() => this.#resize());
            this.#resizeObserver.observe(this.#canvas);
        }
    }
}

function showStartupFailure(status, failure) {
    const message = failure instanceof Error ? failure.message : String(failure);
    status.textContent = `Unable to start: ${message}`;
    status.hidden = false;
    document.documentElement.dataset.appState = "failed";
    console.error("Cave Game browser startup failed.", failure);
}

const canvas = document.querySelector("#game-canvas");
const status = document.querySelector("#status");

if (!(canvas instanceof HTMLCanvasElement) || !(status instanceof HTMLElement)) {
    throw new Error("Required browser application elements are missing");
}

try {
    new BrowserGame(canvas, status).start();
} catch (failure) {
    showStartupFailure(status, failure);
}
