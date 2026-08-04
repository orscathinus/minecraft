export class ChunkPosition {
    constructor(x, z) {
        if (!Number.isInteger(x) || !Number.isInteger(z)) {
            throw new TypeError("ChunkPosition coordinates must be integers");
        }
        this.x = x;
        this.z = z;
        Object.freeze(this);
    }

    key() { return `${this.x},${this.z}`; }

    equals(other) {
        return other instanceof ChunkPosition && other.x === this.x && other.z === this.z;
    }
}
