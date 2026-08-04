export const COLLISION_EPSILON = 1e-7;

export function createAabb(minX, minY, minZ, maxX, maxY, maxZ) {
    for (const [name, value] of Object.entries({ minX, minY, minZ, maxX, maxY, maxZ })) {
        if (!Number.isFinite(value)) throw new TypeError(`${name} must be finite`);
    }
    if (maxX <= minX || maxY <= minY || maxZ <= minZ) {
        throw new RangeError("AABB maximums must be greater than minimums");
    }
    return Object.freeze({ minX, minY, minZ, maxX, maxY, maxZ });
}

export function intersectsAabb(a, b) {
    return a.maxX > b.minX + COLLISION_EPSILON
        && a.minX < b.maxX - COLLISION_EPSILON
        && a.maxY > b.minY + COLLISION_EPSILON
        && a.minY < b.maxY - COLLISION_EPSILON
        && a.maxZ > b.minZ + COLLISION_EPSILON
        && a.minZ < b.maxZ - COLLISION_EPSILON;
}

export function blockAabb(x, y, z) {
    if (!Number.isInteger(x) || !Number.isInteger(y) || !Number.isInteger(z)) {
        throw new TypeError("Block coordinates must be integers");
    }
    return createAabb(x, y, z, x + 1, y + 1, z + 1);
}
