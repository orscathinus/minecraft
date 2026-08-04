import { createAabb, intersectsAabb } from "./aabb.mjs";
import { isOpaqueBlock } from "./block-type.mjs";
import { addVectors, lookAtMatrix, normalize } from "./math.mjs";

const MAX_PITCH = 89 * Math.PI / 180;
const MAX_COLLISION_STEP = 0.25;

export const PlayerConfig = Object.freeze({
    width: 0.60,
    height: 1.62,
    eyeHeight: 1.54,
    moveSpeed: 4.3,
    gravity: 20,
    jumpSpeed: 7.5,
    terminalVelocity: 50,
});

export const VoidSafetyConfig = Object.freeze({
    coordinateLimit: 1_000_000_000_000,
    rebaseMagnitude: 1_000_000_000,
});

export function playerAabb(position, config = PlayerConfig) {
    requirePosition(position);
    const halfWidth = config.width / 2;
    return createAabb(
        position[0] - halfWidth,
        position[1],
        position[2] - halfWidth,
        position[0] + halfWidth,
        position[1] + config.height,
        position[2] + halfWidth,
    );
}

export function movePlayerAabb(world, position, displacement, config = PlayerConfig) {
    requirePosition(position);
    requirePosition(displacement, "displacement");
    const steps = Math.max(1, Math.ceil(Math.max(...displacement.map(Math.abs)) / MAX_COLLISION_STEP));
    const step = displacement.map(value => value / steps);
    let current = [...position];
    let hitX = false;
    let hitZ = false;
    let hitFloor = false;
    let hitCeiling = false;

    for (let index = 0; index < steps; index += 1) {
        const xResult = moveAxis(world, current, step[0], 0, config);
        current = xResult.position;
        hitX ||= xResult.collided;

        const zResult = moveAxis(world, current, step[2], 2, config);
        current = zResult.position;
        hitZ ||= zResult.collided;

        const yResult = moveAxis(world, current, step[1], 1, config);
        current = yResult.position;
        if (yResult.collided && step[1] < 0) hitFloor = true;
        if (yResult.collided && step[1] > 0) hitCeiling = true;
    }

    return Object.freeze({
        position: Object.freeze(current),
        hitX,
        hitZ,
        hitFloor,
        hitCeiling,
        grounded: hitFloor,
    });
}

export class PlayerPhysics {
    #world;
    #position;
    #velocityX = 0;
    #velocityY = 0;
    #velocityZ = 0;
    #yaw;
    #pitch;
    #grounded = false;
    #voidSafetyRebases = 0;

    constructor(world, {
        position = [128.5, 64, 128.5],
        yaw = 0,
        pitch = -0.12,
    } = {}) {
        if (!world || typeof world.getBlock !== "function") {
            throw new TypeError("PlayerPhysics requires a voxel world");
        }
        requirePosition(position);
        this.#world = world;
        this.#position = [...position];
        this.#yaw = yaw;
        this.#pitch = clamp(pitch, -MAX_PITCH, MAX_PITCH);
    }

    update(stepSeconds, input = {}) {
        if (!Number.isFinite(stepSeconds) || stepSeconds <= 0 || stepSeconds > 0.25) {
            throw new RangeError("stepSeconds must be in (0, 0.25]");
        }

        let moveX = 0;
        let moveZ = 0;
        const forwardX = Math.sin(this.#yaw);
        const forwardZ = -Math.cos(this.#yaw);
        const rightX = Math.cos(this.#yaw);
        const rightZ = Math.sin(this.#yaw);
        if (input.forward) { moveX += forwardX; moveZ += forwardZ; }
        if (input.backward) { moveX -= forwardX; moveZ -= forwardZ; }
        if (input.right) { moveX += rightX; moveZ += rightZ; }
        if (input.left) { moveX -= rightX; moveZ -= rightZ; }
        const horizontalLength = Math.hypot(moveX, moveZ);
        if (horizontalLength > 0) {
            moveX = moveX / horizontalLength * PlayerConfig.moveSpeed;
            moveZ = moveZ / horizontalLength * PlayerConfig.moveSpeed;
        }
        this.#velocityX = moveX;
        this.#velocityZ = moveZ;

        if (input.jumpPressed && this.#grounded) {
            this.#velocityY = PlayerConfig.jumpSpeed;
            this.#grounded = false;
        }
        this.#velocityY = Math.max(
            this.#velocityY - PlayerConfig.gravity * stepSeconds,
            -PlayerConfig.terminalVelocity,
        );

        const movement = movePlayerAabb(this.#world, this.#position, [
            this.#velocityX * stepSeconds,
            this.#velocityY * stepSeconds,
            this.#velocityZ * stepSeconds,
        ]);
        this.#position = [...movement.position];
        if (movement.hitX) this.#velocityX = 0;
        if (movement.hitZ) this.#velocityZ = 0;
        if (movement.hitFloor || movement.hitCeiling) this.#velocityY = 0;
        this.#grounded = movement.grounded;
        this.#applyExtremeCoordinateSafeguard();
        return this.snapshot();
    }

    respawn(position) {
        requirePosition(position, "respawn position");
        this.#position = [...position];
        this.#velocityX = 0;
        this.#velocityY = 0;
        this.#velocityZ = 0;
        this.#grounded = false;
        return this.snapshot();
    }

    rotate(deltaYaw, deltaPitch) {
        if (!Number.isFinite(deltaYaw) || !Number.isFinite(deltaPitch)) {
            throw new TypeError("Look deltas must be finite");
        }
        this.#yaw += deltaYaw;
        this.#pitch = clamp(this.#pitch + deltaPitch, -MAX_PITCH, MAX_PITCH);
    }

    viewMatrix() {
        const eye = [
            this.#position[0],
            this.#position[1] + PlayerConfig.eyeHeight,
            this.#position[2],
        ];
        return lookAtMatrix(eye, addVectors(eye, this.forwardVector()));
    }

    forwardVector() {
        const cosinePitch = Math.cos(this.#pitch);
        return normalize([
            Math.sin(this.#yaw) * cosinePitch,
            Math.sin(this.#pitch),
            -Math.cos(this.#yaw) * cosinePitch,
        ]);
    }

    snapshot() {
        return Object.freeze({
            position: Object.freeze([...this.#position]),
            velocity: Object.freeze([this.#velocityX, this.#velocityY, this.#velocityZ]),
            velocityX: this.#velocityX,
            velocityY: this.#velocityY,
            velocityZ: this.#velocityZ,
            grounded: this.#grounded,
            yaw: this.#yaw,
            pitch: this.#pitch,
            belowWorld: this.#position[1] < 0,
            voidSafetyRebases: this.#voidSafetyRebases,
        });
    }

    get grounded() { return this.#grounded; }
    get position() { return Object.freeze([...this.#position]); }

    #applyExtremeCoordinateSafeguard() {
        let changed = false;
        for (let axis = 0; axis < 3; axis += 1) {
            const value = this.#position[axis];
            if (Math.abs(value) <= VoidSafetyConfig.coordinateLimit) continue;
            this.#position[axis] = Math.sign(value || 1) * VoidSafetyConfig.rebaseMagnitude;
            changed = true;
        }
        if (changed) this.#voidSafetyRebases += 1;
    }
}

function moveAxis(world, position, delta, axis, config) {
    if (delta === 0) return { position: [...position], collided: false };
    const proposed = [...position];
    proposed[axis] += delta;
    const bounds = playerAabb(proposed, config);
    const minX = Math.floor(bounds.minX + 1e-7);
    const maxX = Math.floor(bounds.maxX - 1e-7);
    const minY = Math.floor(bounds.minY + 1e-7);
    const maxY = Math.floor(bounds.maxY - 1e-7);
    const minZ = Math.floor(bounds.minZ + 1e-7);
    const maxZ = Math.floor(bounds.maxZ - 1e-7);
    let resolved = proposed[axis];
    let collided = false;

    for (let y = minY; y <= maxY; y += 1) {
        for (let z = minZ; z <= maxZ; z += 1) {
            for (let x = minX; x <= maxX; x += 1) {
                if (!isOpaqueBlock(world.getBlock(x, y, z))) continue;
                const block = createAabb(x, y, z, x + 1, y + 1, z + 1);
                if (!intersectsAabb(bounds, block)) continue;
                collided = true;
                const candidate = collisionLimit(axis, delta, x, y, z, config);
                resolved = delta > 0 ? Math.min(resolved, candidate) : Math.max(resolved, candidate);
            }
        }
    }
    proposed[axis] = resolved;
    return { position: proposed, collided };
}

function collisionLimit(axis, delta, blockX, blockY, blockZ, config) {
    if (axis === 0) return delta > 0 ? blockX - config.width / 2 : blockX + 1 + config.width / 2;
    if (axis === 2) return delta > 0 ? blockZ - config.width / 2 : blockZ + 1 + config.width / 2;
    return delta > 0 ? blockY - config.height : blockY + 1;
}

function requirePosition(position, name = "position") {
    if (!Array.isArray(position) || position.length !== 3 || position.some(value => !Number.isFinite(value))) {
        throw new TypeError(`${name} must contain three finite numbers`);
    }
}

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}
