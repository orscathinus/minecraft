export const BlockType = Object.freeze({ AIR: 0, GRASS: 1, ROCK: 2 });
const VALID = new Set(Object.values(BlockType));
export function isValidBlockType(value) { return Number.isInteger(value) && VALID.has(value); }
export function isOpaqueBlock(value) { return value === BlockType.GRASS || value === BlockType.ROCK; }
export function blockTypeName(value) {
    switch (value) {
        case BlockType.AIR: return "AIR";
        case BlockType.GRASS: return "GRASS";
        case BlockType.ROCK: return "ROCK";
        default: throw new RangeError(`Unknown block type: ${value}`);
    }
}
