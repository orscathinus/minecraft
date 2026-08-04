import { BlockType, isOpaqueBlock } from "./block-type.mjs";
import { WorldConfig } from "./world-config.mjs";

export const CaveConfig = Object.freeze({
    tunnelCount: 6,
    minimumY: 1,
    minimumRadius: 1.20,
    maximumRadius: 2.25,
});

export class CaveGenerator {
    constructor(seed = WorldConfig.defaultSeed) {
        if (!Number.isInteger(seed)) throw new TypeError("seed must be an integer");
        this.seed = seed | 0;
    }

    carveWorldSync(world, onProgress = null) {
        requireWorld(world);
        world.clearDirtyChunks?.();
        const random = mulberry32(this.seed ^ 0x43a7f15d);
        const stats = { carvedBlocks: 0, minY: WorldConfig.maxY, surfaceOpenings: 0 };
        const hubX = integerBetween(random, 80, 175) + 0.5;
        const hubZ = integerBetween(random, 80, 175) + 0.5;
        const hubSurface = highestSolidY(world, Math.floor(hubX), Math.floor(hubZ));

        this.#carvePit(world, hubX, hubSurface, hubZ, stats);
        onProgress?.(1, CaveConfig.tunnelCount + 1);

        for (let tunnel = 0; tunnel < CaveConfig.tunnelCount; tunnel += 1) {
            this.#carveTunnel(world, tunnel, hubX, hubZ, random, stats);
            onProgress?.(tunnel + 2, CaveConfig.tunnelCount + 1);
        }

        recalculateSurfaceGrass(world);
        const affectedChunks = world.dirtyChunkPositions?.() ?? Object.freeze([]);
        return Object.freeze({
            seed: this.seed,
            carvedBlocks: stats.carvedBlocks,
            minimumCarvedY: stats.carvedBlocks === 0 ? null : stats.minY,
            surfaceOpenings: stats.surfaceOpenings,
            affectedChunks,
        });
    }

    async carveWorld(world, { onProgress = null } = {}) {
        const result = this.carveWorldSync(world, onProgress);
        await new Promise(resolve => setTimeout(resolve, 0));
        return result;
    }

    #carvePit(world, x, surfaceY, z, stats) {
        for (let depth = 0; depth <= 9; depth += 1) {
            const radius = 1.35 + depth * 0.055;
            carveSphere(world, x, surfaceY - depth + 0.2, z, radius, stats);
        }
    }

    #carveTunnel(world, tunnel, hubX, hubZ, random, stats) {
        const connected = tunnel < 2;
        let x = connected ? hubX + (random() - 0.5) * 3 : integerBetween(random, 18, 237) + 0.5;
        let z = connected ? hubZ + (random() - 0.5) * 3 : integerBetween(random, 18, 237) + 0.5;
        const surfaceY = highestSolidY(world, Math.floor(x), Math.floor(z));
        const startsAtSurface = tunnel < 5;
        const startY = startsAtSurface ? surfaceY + 0.15 : surfaceY - 5 - random() * 5;
        const steps = tunnel === 0 ? 104 : integerBetween(random, 48, 76);
        let heading = random() * Math.PI * 2;
        let y = startY;

        for (let step = 0; step < steps; step += 1) {
            const progress = steps <= 1 ? 1 : step / (steps - 1);
            if (tunnel === 0) {
                const eased = progress * progress * (3 - 2 * progress);
                y = Math.max(
                    CaveConfig.minimumY + 0.35,
                    startY + (1.35 - startY) * eased + Math.sin(step * 0.23) * 0.28,
                );
            } else {
                const downwardBias = tunnel % 2 === 0 ? -0.22 : -0.12;
                y = clamp(
                    y + downwardBias + (random() - 0.5) * 0.48,
                    2.0,
                    WorldConfig.surfaceMaxY + 0.25,
                );
            }

            heading += (random() - 0.5) * 0.34
                + Math.sin((step + tunnel * 11) * 0.12) * 0.035;
            x += Math.cos(heading) * 0.92;
            z += Math.sin(heading) * 0.92;
            if (x < 3 || x > WorldConfig.maxX - 3) {
                heading = Math.PI - heading;
                x = clamp(x, 3, WorldConfig.maxX - 3);
            }
            if (z < 3 || z > WorldConfig.maxZ - 3) {
                heading = -heading;
                z = clamp(z, 3, WorldConfig.maxZ - 3);
            }

            const wave = 0.5 + 0.5 * Math.sin(step * 0.31 + tunnel * 1.7);
            const radius = CaveConfig.minimumRadius
                + wave * 0.55
                + random() * (CaveConfig.maximumRadius - CaveConfig.minimumRadius - 0.55);
            carveSphere(world, x, y, z, radius, stats);

            if (step > 12 && step % 23 === 0) {
                carveSphere(
                    world,
                    x,
                    y - 1.1,
                    z,
                    Math.min(radius + 0.45, CaveConfig.maximumRadius),
                    stats,
                );
            }
        }
    }
}

export function carveSphere(world, centerX, centerY, centerZ, radius, stats = null) {
    requireWorld(world);
    if (![centerX, centerY, centerZ, radius].every(Number.isFinite) || radius <= 0) {
        throw new TypeError("sphere center and radius must be finite, with a positive radius");
    }
    const minX = Math.max(WorldConfig.minX, Math.floor(centerX - radius));
    const maxX = Math.min(WorldConfig.maxX, Math.floor(centerX + radius));
    const minY = Math.max(CaveConfig.minimumY, Math.floor(centerY - radius));
    const maxY = Math.min(WorldConfig.maxY, Math.floor(centerY + radius));
    const minZ = Math.max(WorldConfig.minZ, Math.floor(centerZ - radius));
    const maxZ = Math.min(WorldConfig.maxZ, Math.floor(centerZ + radius));
    const radiusSquared = radius * radius;
    let changed = 0;

    for (let y = minY; y <= maxY; y += 1) {
        for (let z = minZ; z <= maxZ; z += 1) {
            for (let x = minX; x <= maxX; x += 1) {
                const dx = x + 0.5 - centerX;
                const dy = y + 0.5 - centerY;
                const dz = z + 0.5 - centerZ;
                if (dx * dx + dy * dy + dz * dz > radiusSquared) continue;
                const block = world.getBlock(x, y, z);
                if (!isOpaqueBlock(block)) continue;
                if (!world.setBlock(x, y, z, BlockType.AIR)) continue;
                changed += 1;
                if (stats) {
                    stats.carvedBlocks += 1;
                    stats.minY = Math.min(stats.minY, y);
                    if (block === BlockType.GRASS) stats.surfaceOpenings += 1;
                }
            }
        }
    }
    return changed;
}

export function recalculateSurfaceGrass(world) {
    requireWorld(world);
    for (let z = WorldConfig.minZ; z <= WorldConfig.maxZ; z += 1) {
        for (let x = WorldConfig.minX; x <= WorldConfig.maxX; x += 1) {
            let foundTopSolid = false;
            for (let y = WorldConfig.maxY; y >= WorldConfig.minY; y -= 1) {
                const block = world.getBlock(x, y, z);
                if (block === BlockType.AIR) continue;
                const shouldBeGrass = !foundTopSolid
                    && y >= WorldConfig.surfaceMinY
                    && y <= WorldConfig.surfaceMaxY;
                const expected = shouldBeGrass ? BlockType.GRASS : BlockType.ROCK;
                if (block !== expected) world.setBlock(x, y, z, expected);
                foundTopSolid = true;
            }
        }
    }
}

function highestSolidY(world, x, z) {
    for (let y = WorldConfig.maxY; y >= WorldConfig.minY; y -= 1) {
        if (isOpaqueBlock(world.getBlock(x, y, z))) return y;
    }
    return WorldConfig.surfaceMinY;
}

function integerBetween(random, min, max) {
    return min + Math.floor(random() * (max - min + 1));
}

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function requireWorld(world) {
    if (!world || typeof world.getBlock !== "function" || typeof world.setBlock !== "function") {
        throw new TypeError("cave generation requires a voxel world");
    }
}

function mulberry32(seed) {
    let value = seed >>> 0;
    return () => {
        value += 0x6d2b79f5;
        let result = value;
        result = Math.imul(result ^ (result >>> 15), result | 1);
        result ^= result + Math.imul(result ^ (result >>> 7), result | 61);
        return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
    };
}
