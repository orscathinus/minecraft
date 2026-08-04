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
    #input = {
        forward: false,
        backward: false,
        left: false,
        right: false,
        jumpPressed: false,
    };
    #spawnState = {};

    constructor(canvas, world, {
        position,
        yaw = 0,
        pitch = -0.12,
        mouseSensitivity = 0.0024,
        spawnController = new HistoricalSpawnController(),
    } = {}) {
        if (!(canvas instanceof HTMLCanvasElement)) throw new TypeError("FirstPersonPlayer requires a canvas");
        if (!spawnController || typeof spawnController.updateHeldFast !== "function"
            || typeof spawnController.writeSnapshot !== "function") {
            throw new TypeError("FirstPersonPlayer requires a historical spawn controller");
        }
        this.#canvas = canvas;
        this.#body = new PlayerPhysics(world, { position, yaw, pitch });
        this.#spawnController = spawnController;
        this.#mouseSensitivity = mouseSensitivity;
        this.#installListeners();
    }

    advance(stepSeconds) {
        this.#respawnedLastUpdate = false;
        if (this.#mouseDeltaX !== 0 || this.#mouseDeltaY !== 0) {
            this.#body.rotate(
                this.#mouseDeltaX * this.#mouseSensitivity,
                -this.#mouseDeltaY * this.#mouseSensitivity,
            );
            this.#mouseDeltaX = 0;
            this.#mouseDeltaY = 0;
        }

        if (this.#spawnController.updateHeldFast(this.#body, this.#keys.has("KeyR"))) {
            this.#jumpQueued = false;
            this.#respawnedLastUpdate = true;
            return;
        }

        this.#input.forward = this.#keys.has("KeyW");
        this.#input.backward = this.#keys.has("KeyS");
        this.#input.left = this.#keys.has("KeyA");
        this.#input.right = this.#keys.has("KeyD");
        this.#input.jumpPressed = this.#consumeJump();
        this.#body.advance(stepSeconds, this.#input);
    }

    update(stepSeconds) {
        this.advance(stepSeconds);
        return this.snapshot();
    }

    viewMatrix() { return this.#body.viewMatrix(); }

    writeSnapshot(target) {
        this.#body.writeSnapshot(target);
        this.#spawnController.writeSnapshot(this.#spawnState);
        target.rHeld = this.#keys.has("KeyR");
        target.respawnedLastUpdate = this.#respawnedLastUpdate;
        target.respawnCount = this.#spawnState.respawnCount;
        target.totalSpawns = this.#spawnState.totalSpawns;
        target.lastSpawnX = this.#spawnState.lastX;
        target.lastSpawnY = this.#spawnState.lastY;
        target.lastSpawnZ = this.#spawnState.lastZ;
        return target;
    }

    snapshot() {
        const state = this.writeSnapshot({});
        state.position = Object.freeze([state.x, state.y, state.z]);
        state.velocity = Object.freeze([state.velocityX, state.velocityY, state.velocityZ]);
        state.lastSpawn = this.#spawnState.hasSpawn
            ? Object.freeze({ position: Object.freeze([state.lastSpawnX, state.lastSpawnY, state.lastSpawnZ]) })
            : null;
        return Object.freeze(state);
    }

    get grounded() { return this.#body.grounded; }
    get position() { return this.#body.position; }
    get x() { return this.#body.x; }
    get y() { return this.#body.y; }
    get z() { return this.#body.z; }

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
        this.#listeners.length = 0;
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
