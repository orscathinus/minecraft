import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { deflateSync } from "node:zlib";
import {
    BLOCK_TEXTURE_SIZE,
    BlockMaterial,
    generateBlockTexture,
} from "../web/block-textures.mjs";
import {
    ATLAS_HEIGHT,
    ATLAS_WIDTH,
    createAtlasPixels,
} from "../web/atlas.mjs";

export async function generateTexturePreviews(outputDirectory = "generated-texture-previews") {
    const directory = resolve(outputDirectory);
    await mkdir(directory, { recursive: true });

    const outputs = [
        ["grass.png", BLOCK_TEXTURE_SIZE, BLOCK_TEXTURE_SIZE, generateBlockTexture(BlockMaterial.GRASS)],
        ["rock.png", BLOCK_TEXTURE_SIZE, BLOCK_TEXTURE_SIZE, generateBlockTexture(BlockMaterial.ROCK)],
        ["block-atlas.png", ATLAS_WIDTH, ATLAS_HEIGHT, createAtlasPixels()],
    ];

    for (const [name, width, height, pixels] of outputs) {
        await writeFile(resolve(directory, name), encodeRgbaPng(width, height, pixels));
    }
    return Object.freeze(outputs.map(([name]) => resolve(directory, name)));
}

export function encodeRgbaPng(width, height, pixels) {
    if (!Number.isInteger(width) || width <= 0 || !Number.isInteger(height) || height <= 0) {
        throw new RangeError("PNG dimensions must be positive integers");
    }
    if (!(pixels instanceof Uint8Array) || pixels.length !== width * height * 4) {
        throw new TypeError("pixels must be RGBA Uint8Array matching the image dimensions");
    }

    const scanlines = Buffer.alloc(height * (1 + width * 4));
    const rowBytes = width * 4;
    for (let y = 0; y < height; y += 1) {
        const destination = y * (rowBytes + 1);
        scanlines[destination] = 0;
        Buffer.from(pixels.buffer, pixels.byteOffset + y * rowBytes, rowBytes)
            .copy(scanlines, destination + 1);
    }

    const header = Buffer.alloc(13);
    header.writeUInt32BE(width, 0);
    header.writeUInt32BE(height, 4);
    header[8] = 8;
    header[9] = 6;
    header[10] = 0;
    header[11] = 0;
    header[12] = 0;

    return Buffer.concat([
        Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
        pngChunk("IHDR", header),
        pngChunk("IDAT", deflateSync(scanlines, { level: 9 })),
        pngChunk("IEND", Buffer.alloc(0)),
    ]);
}

function pngChunk(type, data) {
    const typeBytes = Buffer.from(type, "ascii");
    const output = Buffer.alloc(12 + data.length);
    output.writeUInt32BE(data.length, 0);
    typeBytes.copy(output, 4);
    data.copy(output, 8);
    output.writeUInt32BE(crc32(Buffer.concat([typeBytes, data])), 8 + data.length);
    return output;
}

function crc32(bytes) {
    let crc = 0xffffffff;
    for (const byte of bytes) {
        crc ^= byte;
        for (let bit = 0; bit < 8; bit += 1) {
            crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
        }
    }
    return (crc ^ 0xffffffff) >>> 0;
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
    const files = await generateTexturePreviews(process.argv[2]);
    for (const file of files) console.info(file);
}
