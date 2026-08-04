# Browser target amendment

## Status

The primary public build is a browser-playable application hosted by GitHub Pages. Where delivery requirements conflict with desktop-only assumptions in `SPEC.md` or `ROADMAP.md`, this document governs the browser target. The Java/LWJGL desktop application remains a reference target.

## Browser technology

- HTML5 and JavaScript modules;
- WebGL 2 and GLSL ES 3.00 resource shaders;
- `requestAnimationFrame` rendering;
- fixed 60-updates-per-second simulation timing;
- no server-side runtime.

The browser build lives in `web/`. A root `index.html` loads the same modules for branch-based GitHub Pages.

## Phase 7 original block textures

`web/block-textures.mjs` deterministically generates two original `16 × 16` RGBA textures. GRASS uses a mottled six-color green palette. ROCK uses a dark irregular six-color neutral-gray palette. The algorithms and palettes were created specifically for this repository and do not load, copy, trace, sample, or derive pixels from Minecraft, Mojang, RubyDung, or another game.

The same material is assigned to all six faces of each block. GRASS never switches to a dirt side, and ROCK has no alternate top or bottom. The renderer continues to use only position, atlas UV, and basic brightness vertex attributes; it adds no normal maps, PBR channels, shadows, ambient occlusion, or animation.

## Atlas boundary protection

`web/atlas.mjs` packs the two materials into one runtime atlas. Every `16 × 16` tile receives a one-pixel replicated gutter on all four sides. Tile UVs cover the complete interior texel rectangle while remaining slightly inside its mathematical boundary. Therefore interpolation and rasterization near an edge encounter a copy of the same material instead of the neighboring tile.

`web/pixel-texture-sampling.mjs` configures `NEAREST` for both minification and magnification and uses `CLAMP_TO_EDGE` wrapping. The renderer does not call `generateMipmap` and selects no mipmap minification mode.

## Retained generation tool

`tools/generate-block-textures.mjs` imports the exact runtime texture source and can write deterministic grass, rock, and padded-atlas PNG previews under `build/texture-previews/`. It uses only Node built-in modules. Preview generation is a development aid; the browser consumes the source RGBA pixels directly.

## Existing world and player systems

The Phase 6 finite terrain, sphere-worm caves, chunk seam handling, cave-adjacent spawn, and the Phase 5 collision-enabled first-person player remain unchanged. The complete cave-aware world still renders as one aggregate indexed WebGL draw call.

## Testing

Node tests verify stable texture checksums, full opacity, color distinction, green and neutral-gray palette characteristics, exact replicated gutters, bleeding-safe UV bounds, identical tile selection and UV order on every face of both block types, nearest-only sampling, disabled mipmaps, and deterministic PNG encoding.

The Chromium smoke test loads both GitHub Pages entry points and requires the Phase 7 title and texture metadata, original procedural provenance, `16 × 16` resolution, a one-pixel gutter, nearest filtering, disabled mipmaps, visible cave-world geometry, one draw call, and zero WebGL errors.

## Scope boundary

Phase 7 does not add lighting, shadows, ambient occlusion, normal maps, PBR materials, animated textures, dirt, additional block types, block interaction, inventory, enemies, sound, or persistence.
