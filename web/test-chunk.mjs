import { BlockType } from "./block-type.mjs";
import { Chunk } from "./chunk.mjs";
import { ChunkPosition } from "./chunk-position.mjs";
import { World } from "./world.mjs";

export function createDeterministicTestWorld() {
    const world = new World();
    const chunk = new Chunk(new ChunkPosition(0, 0));

    for (let z = 0; z < 16; z += 1) {
        for (let x = 0; x < 16; x += 1) chunk.setBlock(x, 0, z, BlockType.ROCK);
    }

    for (let y = 1; y <= 4; y += 1) {
        for (let coordinate = 0; coordinate < 16; coordinate += 1) {
            chunk.setBlock(coordinate, y, 0, BlockType.ROCK);
            chunk.setBlock(coordinate, y, 15, BlockType.ROCK);
            chunk.setBlock(0, y, coordinate, BlockType.ROCK);
            chunk.setBlock(15, y, coordinate, BlockType.ROCK);
        }
    }

    // Doorway through the near wall.
    for (let y = 1; y <= 3; y += 1) {
        for (let x = 7; x <= 8; x += 1) chunk.setBlock(x, y, 15, BlockType.AIR);
    }

    // Rock ridge with a two-block-wide, three-block-high empty tunnel.
    for (let y = 1; y <= 4; y += 1) {
        for (let z = 5; z <= 10; z += 1) {
            for (let x = 5; x <= 10; x += 1) chunk.setBlock(x, y, z, BlockType.ROCK);
        }
    }
    for (let z = 5; z <= 10; z += 1) {
        for (let y = 1; y <= 3; y += 1) {
            for (let x = 7; x <= 8; x += 1) chunk.setBlock(x, y, z, BlockType.AIR);
        }
    }

    const grassBlocks = [[2,1,3],[3,1,3],[12,1,4],[11,1,11],[3,1,12],[12,1,12]];
    for (const [x, y, z] of grassBlocks) chunk.setBlock(x, y, z, BlockType.GRASS);

    world.addChunk(chunk);
    return Object.freeze({ world, chunk });
}
