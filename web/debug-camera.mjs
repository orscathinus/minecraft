import { addVectors, cross, lookAtMatrix, normalize, scaleVector } from "./math.mjs";

const MAX_PITCH = 89 * Math.PI / 180;

export class DebugCamera {
    #canvas;
    #position;
    #yaw;
    #pitch;
    #moveSpeed;
    #fastMoveSpeed;
    #keys = new Set();
    #listeners = [];

    constructor(canvas, {
        position = [128, 74, 270],
        yaw = 0,
        pitch = -0.12,
        moveSpeed = 18,
        fastMoveSpeed = 48,
    } = {}) {
        if (!(canvas instanceof HTMLCanvasElement)) throw new TypeError("DebugCamera requires a canvas");
        this.#canvas = canvas;
        this.#position = [...position];
        this.#yaw = yaw;
        this.#pitch = pitch;
        this.#moveSpeed = moveSpeed;
        this.#fastMoveSpeed = fastMoveSpeed;
        this.#installListeners();
    }

    update(stepSeconds) {
        const turnSpeed = 1.65;
        if (this.#keys.has("ArrowLeft")) this.#yaw -= turnSpeed * stepSeconds;
        if (this.#keys.has("ArrowRight")) this.#yaw += turnSpeed * stepSeconds;
        if (this.#keys.has("ArrowUp")) this.#pitch += turnSpeed * stepSeconds;
        if (this.#keys.has("ArrowDown")) this.#pitch -= turnSpeed * stepSeconds;
        this.#pitch = clamp(this.#pitch, -MAX_PITCH, MAX_PITCH);

        const forward = this.forwardVector();
        const horizontalForward = normalize([forward[0], 0, forward[2]]);
        const right = normalize(cross(horizontalForward, [0, 1, 0]));
        const speed = this.#keys.has("ShiftLeft") || this.#keys.has("ShiftRight")
            ? this.#fastMoveSpeed
            : this.#moveSpeed;
        let movement = [0, 0, 0];
        if (this.#keys.has("KeyW")) movement = addVectors(movement, horizontalForward);
        if (this.#keys.has("KeyS")) movement = addVectors(movement, scaleVector(horizontalForward, -1));
        if (this.#keys.has("KeyD")) movement = addVectors(movement, right);
        if (this.#keys.has("KeyA")) movement = addVectors(movement, scaleVector(right, -1));
        if (this.#keys.has("KeyE")) movement[1] += 1;
        if (this.#keys.has("KeyQ")) movement[1] -= 1;
        const length = Math.hypot(...movement);
        if (length > 0) {
            this.#position = addVectors(this.#position, scaleVector(movement, speed * stepSeconds / length));
        }
    }

    viewMatrix() {
        return lookAtMatrix(this.#position, addVectors(this.#position, this.forwardVector()));
    }

    forwardVector() {
        const cosinePitch = Math.cos(this.#pitch);
        return normalize([
            Math.sin(this.#yaw) * cosinePitch,
            Math.sin(this.#pitch),
            -Math.cos(this.#yaw) * cosinePitch,
        ]);
    }

    dispose() {
        for (const [target, type, listener, options] of this.#listeners) {
            target.removeEventListener(type, listener, options);
        }
        this.#listeners = [];
        this.#keys.clear();
    }

    #installListeners() {
        this.#listen(window, "keydown", event => {
            if (event.code.startsWith("Arrow") || event.code.startsWith("Key") || event.code.startsWith("Shift")) {
                this.#keys.add(event.code);
            }
        });
        this.#listen(window, "keyup", event => this.#keys.delete(event.code));
        this.#listen(window, "blur", () => this.#keys.clear());
        this.#listen(this.#canvas, "click", () => {
            if (document.pointerLockElement !== this.#canvas) this.#canvas.requestPointerLock?.();
        });
        this.#listen(document, "mousemove", event => {
            if (document.pointerLockElement !== this.#canvas) return;
            this.#yaw += event.movementX * 0.0024;
            this.#pitch = clamp(this.#pitch - event.movementY * 0.0024, -MAX_PITCH, MAX_PITCH);
        });
    }

    #listen(target, type, listener, options) {
        target.addEventListener(type, listener, options);
        this.#listeners.push([target, type, listener, options]);
    }
}

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}
