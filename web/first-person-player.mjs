import { PlayerPhysics } from "./player-physics.mjs";
import { HistoricalSpawnController } from "./spawn-controller.mjs";

const MOVEMENT_CODES = new Set(["KeyW", "KeyS", "KeyA", "KeyD", "KeyR"]);

export class FirstPersonPlayer {
    #canvas;
    #body;
    #spawnController;
    #keys = new Set();
    #jumpQueued = false;
    #mouseDeltaX = 0;
    #mouseDeltaY = 0;
    #listeners = [];
    #mouseSensitivity;
    #respawnedLastUpdate = false;

    constructor(canvas, world, {
        position,
        yaw = 0,
        pitch = -0.12,
        mouseSensitivity = 0.0024,
        spawnController = new HistoricalSpawnController(),
    } = {}) {
        if (!(canvas instanceof HTMLCanvasElement)) {
            throw new TypeError("FirstPersonPlayer requires a canvas");
        }
        if (!spawnController || typeof spawnController.updateHeld !== "function"
            || typeof spawnController.snapshot !== "function") {
            throw new TypeError("FirstPersonPlayer requires a historical spawn controller");
        }
        this.#canvas = canvas;
        this.#body = new PlayerPhysics(world, { position, yaw, pitch });
        this.#spawnController = spawnController;
        this.#mouseSensitivity = mouseSensitivity;
        this.#installListeners();
    }

    update(stepSeconds) {
        this.#respawnedLastUpdate = false;
        if (this.#mouseDeltaX !== 0 || this.#mouseDeltaY !== 0) {
            this.#body.rotate(
                this.#mouseDeltaX * this.#mouseSensitivity,
                -this.#mouseDeltaY * this.#mouseSensitivity,
            );
            this.#mouseDeltaX = 0;
            this.#mouseDeltaY = 0;
        }

        const respawn = this.#spawnController.updateHeld(this.#body, this.#keys.has("KeyR"));
        if (respawn !== null) {
            this.#jumpQueued = false;
            this.#respawnedLastUpdate = true;
            return this.snapshot();
        }

        this.#body.update(stepSeconds, {
            forward: this.#keys.has("KeyW"),
            backward: this.#keys.has("KeyS"),
            left: this.#keys.has("KeyA"),
            right: this.#keys.has("KeyD"),
            jumpPressed: this.#consumeJump(),
        });
        return this.snapshot();
    }

    viewMatrix() { return this.#body.viewMatrix(); }

    snapshot() {
        const body = this.#body.snapshot();
        const spawning = this.#spawnController.snapshot();
        return Object.freeze({
            ...body,
            rHeld: this.#keys.has("KeyR"),
            respawnedLastUpdate: this.#respawnedLastUpdate,
            respawnCount: spawning.respawnCount,
            totalSpawns: spawning.totalSpawns,
            lastSpawn: spawning.lastSpawn,
        });
    }

    get grounded() { return this.#body.grounded; }
    get position() { return this.#body.position; }

    resetInput() {
        this.#keys.clear();
        this.#jumpQueued = false;
        this.#mouseDeltaX = 0;
        this.#mouseDeltaY = 0;
        this.#respawnedLastUpdate = false;
    }

    dispose() {
        for (const [target, type, listener, options] of this.#listeners) {
            target.removeEventListener(type, listener, options);
        }
        this.#listeners = [];
        this.resetInput();
    }

    #consumeJump() {
        const queued = this.#jumpQueued;
        this.#jumpQueued = false;
        return queued;
    }

    #installListeners() {
        this.#listen(window, "keydown", event => {
            if (MOVEMENT_CODES.has(event.code)) {
                this.#keys.add(event.code);
                event.preventDefault();
            } else if (event.code === "Space") {
                if (!event.repeat) this.#jumpQueued = true;
                event.preventDefault();
            }
        });
        this.#listen(window, "keyup", event => {
            if (MOVEMENT_CODES.has(event.code)) this.#keys.delete(event.code);
        });
        this.#listen(window, "blur", () => this.resetInput());
        this.#listen(document, "visibilitychange", () => {
            if (document.hidden) this.resetInput();
        });
        this.#listen(this.#canvas, "click", () => {
            if (document.pointerLockElement !== this.#canvas) this.#canvas.requestPointerLock?.();
        });
        this.#listen(document, "pointerlockchange", () => {
            this.#mouseDeltaX = 0;
            this.#mouseDeltaY = 0;
            if (document.pointerLockElement !== this.#canvas) {
                this.#keys.clear();
                this.#jumpQueued = false;
                this.#respawnedLastUpdate = false;
            }
        });
        this.#listen(document, "mousemove", event => {
            if (document.pointerLockElement !== this.#canvas) return;
            this.#mouseDeltaX += event.movementX;
            this.#mouseDeltaY += event.movementY;
        });
    }

    #listen(target, type, listener, options) {
        target.addEventListener(type, listener, options);
        this.#listeners.push([target, type, listener, options]);
    }
}
