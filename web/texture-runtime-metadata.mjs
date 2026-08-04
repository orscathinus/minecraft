import { ATLAS_GUTTER } from "./atlas.mjs";
import {
    BLOCK_TEXTURE_METADATA,
    BLOCK_TEXTURE_SIZE,
    BLOCK_TEXTURE_VERSION,
} from "./block-textures.mjs";
import { PIXEL_TEXTURE_SAMPLING } from "./pixel-texture-sampling.mjs";

Object.assign(document.documentElement.dataset, {
    texturePhase: "7",
    textureVersion: BLOCK_TEXTURE_VERSION,
    textureSize: String(BLOCK_TEXTURE_SIZE),
    textureAssets: BLOCK_TEXTURE_METADATA.copiedAssets ? "external" : "original-procedural",
    atlasGutter: String(ATLAS_GUTTER),
    textureFiltering: PIXEL_TEXTURE_SAMPLING.minFilter.toLowerCase(),
    textureMipmaps: String(PIXEL_TEXTURE_SAMPLING.mipmaps),
});
