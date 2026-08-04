import { createAabb } from "./aabb.mjs";
import { isOpaqueBlock } from "./block-type.mjs";

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
    const current = new Float64Array(position);
    const result = createMovementResult();
    movePlayerInPlace(world, current, displacement[0], displacement[1], displacement[2], config, result);
    return Object.freeze({
        position: Object.freeze(Array.from(current)),
        hitX: result.hitX,
        hitZ: result.hitZ,
        hitFloor: result.hitFloor,
        hitCeiling: result.hitCeiling,
        grounded: result.grounded,
    });
}

export class PlayerPhysics {
    #world;
    #position = new Float64Array(3);
    #velocityX = 0;
    #velocityY = 0;
    #velocityZ = 0;
    #yaw;
    #pitch;
    #grounded = false;
    #voidSafetyRebases = 0;
    #movement = createMovementResult();
    #viewMatrix = new Float32Array(16);

    constructor(world, {
        position = [128.5, 64, 128.5],
        yaw = 0,
        pitch = -0.12,
    } = {}) {
        if (!world || typeof world.getBlock !== "function") throw new TypeError("PlayerPhysics requires a voxel world");
        requirePosition(position);
        this.#world = world;
        this.#position[0] = position[0];
        this.#position[1] = position[1];
        this.#position[2] = position[2];
        this.#yaw = yaw;
        this.#pitch = clamp(pitch, -MAX_PITCH, MAX_PITCH);
    }

    advance(stepSeconds, input = EMPTY_INPUT) {
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
        this.#velocityY = Math.max(this.#velocityY - PlayerConfig.gravity * stepSeconds, -PlayerConfig.terminalVelocity);

        movePlayerInPlace(
            this.#world,
            this.#position,
            this.#velocityX * stepSeconds,
            this.#velocityY * stepSeconds,
            this.#velocityZ * stepSeconds,
            PlayerConfig,
            this.#movement,
        );
        if (this.#movement.hitX) this.#velocityX = 0;
        if (this.#movement.hitZ) this.#velocityZ = 0;
        if (this.#movement.hitFloor || this.#movement.hitCeiling) this.#velocityY = 0;
        this.#grounded = this.#movement.grounded;
        this.#applyExtremeCoordinateSafeguard();
    }

    update(stepSeconds, input = EMPTY_INPUT) {
        this.advance(stepSeconds, input);
        return this.snapshot();
    }

    respawnXYZ(x, y, z) {
        if (![x, y, z].every(Number.isFinite)) throw new TypeError("respawn coordinates must be finite");
        this.#position[0] = x;
        this.#position[1] = y;
        this.#position[2] = z;
        this.#velocityX = 0;
        this.#velocityY = 0;
        this.#velocityZ = 0;
        this.#grounded = false;
    }

    respawn(position) {
        requirePosition(position, "respawn position");
        this.respawnXYZ(position[0], position[1], position[2]);
        return this.snapshot();
    }

    rotate(deltaYaw, deltaPitch) {
        if (!Number.isFinite(deltaYaw) || !Number.isFinite(deltaPitch)) throw new TypeError("Look deltas must be finite");
        this.#yaw += deltaYaw;
        this.#pitch = clamp(this.#pitch + deltaPitch, -MAX_PITCH, MAX_PITCH);
    }

    viewMatrix() {
        const eyeX = this.#position[0];
        const eyeY = this.#position[1] + PlayerConfig.eyeHeight;
        const eyeZ = this.#position[2];
        const sinYaw = Math.sin(this.#yaw);
        const cosYaw = Math.cos(this.#yaw);
        const sinPitch = Math.sin(this.#pitch);
        const cosPitch = Math.cos(this.#pitch);
        const forwardX = sinYaw * cosPitch;
        const forwardY = sinPitch;
        const forwardZ = -cosYaw * cosPitch;
        const sideX = cosYaw;
        const sideY = 0;
        const sideZ = sinYaw;
        const upX = -sinYaw * sinPitch;
        const upY = cosPitch;
        const upZ = cosYaw * sinPitch;
        const result = this.#viewMatrix;
        result[0] = sideX; result[1] = upX; result[2] = -forwardX; result[3] = 0;
        result[4] = sideY; result[5] = upY; result[6] = -forwardY; result[7] = 0;
        result[8] = sideZ; result[9] = upZ; result[10] = -forwardZ; result[11] = 0;
        result[12] = -(sideX * eyeX + sideY * eyeY + sideZ * eyeZ);
        result[13] = -(upX * eyeX + upY * eyeY + upZ * eyeZ);
        result[14] = forwardX * eyeX + forwardY * eyeY + forwardZ * eyeZ;
        result[15] = 1;
        return result;
    }

    forwardVector() {
        const cosinePitch = Math.cos(this.#pitch);
        return Object.freeze([
            Math.sin(this.#yaw) * cosinePitch,
            Math.sin(this.#pitch),
            -Math.cos(this.#yaw) * cosinePitch,
        ]);
    }

    writeSnapshot(target) {
        if (!target || typeof target !== "object") throw new TypeError("player snapshot target must be an object");
        target.x = this.#position[0];
        target.y = this.#position[1];
        target.z = this.#position[2];
        target.velocityX = this.#velocityX;
        target.velocityY = this.#velocityY;
        target.velocityZ = this.#velocityZ;
        target.grounded = this.#grounded;
        target.yaw = this.#yaw;
        target.pitch = this.#pitch;
        target.belowWorld = this.#position[1] < 0;
        target.voidSafetyRebases = this.#voidSafetyRebases;
        return target;
    }

    snapshot() {
        const state = this.writeSnapshot({});
        state.position = Object.freeze([state.x, state.y, state.z]);
        state.velocity = Object.freeze([state.velocityX, state.velocityY, state.velocityZ]);
        return Object.freeze(state);
    }

    get grounded() { return this.#grounded; }
    get position() { return Object.freeze(Array.from(this.#position)); }
    get x() { return this.#position[0]; }
    get y() { return this.#position[1]; }
    get z() { return this.#position[2]; }

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

const EMPTY_INPUT = Object.freeze({
    forward: false,
    backward: false,
    left: false,
    right: false,
    jumpPressed: false,
});

function createMovementResult() {
    return { hitX: false, hitZ: false, hitFloor: false, hitCeiling: false, grounded: false };
}

function movePlayerInPlace(world, position, deltaX, deltaY, deltaZ, config, result) {
    const maximumDelta = Math.max(Math.abs(deltaX), Math.abs(deltaY), Math.abs(deltaZ));
    const steps = Math.max(1, Math.ceil(maximumDelta / MAX_COLLISION_STEP));
    const stepX = deltaX / steps;
    const stepY = deltaY / steps;
    const stepZ = deltaZ / steps;
    result.hitX = false;
    result.hitZ = false;
    result.hitFloor = false;
    result.hitCeiling = false;

    for (let index = 0; index < steps; index += 1) {
        if (resolveAxisInPlace(world, position, stepX, 0, config)) result.hitX = true;
        if (resolveAxisInPlace(world, position, stepZ, 2, config)) result.hitZ = true;
        if (resolveAxisInPlace(world, position, stepY, 1, config)) {
            if (stepY < 0) result.hitFloor = true;
            if (stepY > 0) result.hitCeiling = true;
        }
    }
    result.grounded = result.hitFloor;
}

function resolveAxisInPlace(world, position, delta, axis, config) {
    if (delta === 0) return false;
    const halfWidth = config.width / 2;
    let proposedAxis = position[axis] + delta;
    const centerX = axis === 0 ? proposedAxis : position[0];
    const feetY = axis === 1 ? proposedAxis : position[1];
    const centerZ = axis === 2 ? proposedAxis : position[2];
    const minX = Math.floor(centerX - halfWidth + 1e-7);
    const maxX = Math.floor(centerX + halfWidth - 1e-7);
    const minY = Math.floor(feetY + 1e-7);
    const maxY = Math.floor(feetY + config.height - 1e-7);
    const minZ = Math.floor(centerZ - halfWidth + 1e-7);
    const maxZ = Math.floor(centerZ + halfWidth - 1e-7);
    let collided = false;

    for (let y = minY; y <= maxY; y += 1) {
        for (let z = minZ; z <= maxZ; z += 1) {
            for (let x = minX; x <= maxX; x += 1) {
                if (!isOpaqueBlock(world.getBlock(x, y, z))) continue;
                collided = true;
                const candidate = collisionLimit(axis, delta, x, y, z, config);
                proposedAxis = delta > 0 ? Math.min(proposedAxis, candidate) : Math.max(proposedAxis, candidate);
            }
        }
    }
    position[axis] = proposedAxis;
    return collided;
}

function collisionLimit(axis, delta, blockX, blockY, blockZ, config) {
    if (axis === 0) return delta > 0 ? blockX - config.width / 2 : blockX + 1 + config.width / 2;
    if (axis === 2) return delta > 0 ? blockZ - config.width / 2 : blockZ + 1 + config.width / 2;
    return delta > 0 ? blockY - config.height : blockY + 1;
}

function requirePosition(position, name = "position") {
    if ((!Array.isArray(position) && !(position instanceof Float64Array) && !(position instanceof Float32Array))
        || position.length !== 3 || Array.from(position).some(value => !Number.isFinite(value))) {
        throw new TypeError(`${name} must contain three finite numbers`);
    }
}

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}
