import { BlockType, isOpaqueBlock } from "./block-type.mjs";
import { WorldConfig, isFiniteWorldCoordinate } from "./world-config.mjs";

export const LightState = Object.freeze({
    DARK: 0,
    BRIGHT: 1,
});

export const LightingConfig = Object.freeze({
    brightBrightness: 1.0,
    darkBrightness: 0.28,
    darkFogStart: 4.0,
    darkFogEnd: 30.0,
    darkFogStrength: 0.96,
    fogSteps: 5,
});

export class SunlightModel {
    #world;
    #topOpaqueY = new Int8Array(WorldConfig.sizeX * WorldConfig.sizeZ);

    constructor(world) {
        requireWorld(world);
        this.#world = world;
        this.#topOpaqueY.fill(-1);
    }

    rebuildAllSync(onProgress = null) {
        for (let z = WorldConfig.minZ; z <= WorldConfig.maxZ; z += 1) {
            for (let x = WorldConfig.minX; x <= WorldConfig.maxX; x += 1) {
                this.rebuildColumn(x, z);
            }
            onProgress?.(z + 1, WorldConfig.sizeZ);
        }
        this.#world.clearDirtyLightingColumns?.();
        return this;
    }

    async rebuildAll({ onProgress = null, yieldEvery = 16 } = {}) {
        for (let z = WorldConfig.minZ; z <= WorldConfig.maxZ; z += 1) {
            for (let x = WorldConfig.minX; x <= WorldConfig.maxX; x += 1) {
                this.rebuildColumn(x, z);
            }
            onProgress?.(z + 1, WorldConfig.sizeZ);
            if ((z + 1) % yieldEvery === 0) await yieldToBrowser();
        }
        this.#world.clearDirtyLightingColumns?.();
        return this;
    }

    rebuildColumn(x, z) {
        validateHorizontalCoordinate(x, z);
        let topOpaqueY = -1;
        for (let y = WorldConfig.maxY; y >= WorldConfig.minY; y -= 1) {
            if (isOpaqueBlock(this.#world.getBlock(x, y, z))) {
                topOpaqueY = y;
                break;
            }
        }
        this.#topOpaqueY[columnIndex(x, z)] = topOpaqueY;
        return topOpaqueY;
    }

    rebuildDirtyColumns() {
        const columns = this.#world.consumeDirtyLightingColumns?.() ?? Object.freeze([]);
        for (const column of columns) this.rebuildColumn(column.x, column.z);
        return columns;
    }

    topOpaqueY(x, z) {
        validateHorizontalCoordinate(x, z);
        return this.#topOpaqueY[columnIndex(x, z)];
    }

    blockState(x, y, z) {
        if (!isFiniteWorldCoordinate(x, y, z)) return LightState.DARK;
        if (!isOpaqueBlock(this.#world.getBlock(x, y, z))) return LightState.DARK;
        return y === this.topOpaqueY(x, z) ? LightState.BRIGHT : LightState.DARK;
    }

    airState(x, y, z) {
        if (!isFiniteWorldCoordinate(x, y, z)) return LightState.DARK;
        if (this.#world.getBlock(x, y, z) !== BlockType.AIR) return LightState.DARK;
        return y > this.topOpaqueY(x, z) ? LightState.BRIGHT : LightState.DARK;
    }

    isBrightBlock(x, y, z) {
        return this.blockState(x, y, z) === LightState.BRIGHT;
    }
}

function columnIndex(x, z) {
    return x + z * WorldConfig.sizeX;
}

function validateHorizontalCoordinate(x, z) {
    if (!Number.isInteger(x) || !Number.isInteger(z)
        || x < WorldConfig.minX || x > WorldConfig.maxX
        || z < WorldConfig.minZ || z > WorldConfig.maxZ) {
        throw new RangeError("sunlight column is outside the finite world");
    }
}

function requireWorld(world) {
    if (!world || typeof world.getBlock !== "function") {
        throw new TypeError("SunlightModel requires a voxel world");
    }
}

function yieldToBrowser() {
    return new Promise(resolve => setTimeout(resolve, 0));
}
