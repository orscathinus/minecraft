# Cave Game Tech Test Recreation

A small, historically inspired recreation targeting the technical scope of the May 13, 2009 **Cave Game Tech Test**.

This is an independent educational recreation. It is not affiliated with Mojang or Microsoft, and it does not include copyrighted Minecraft textures, sounds, source code, or other assets.

## Play in a browser

**https://orscathinus.github.io/minecraft/**

The project supports GitHub Pages from `main` / repository root and through the GitHub Actions deployment of `web/`.

## Current status: Phase 7 original block textures

The browser build keeps the finite seeded world, primitive caves, and collision-enabled first-person player from earlier phases, but replaces the temporary block colors with final original low-resolution materials.

- GRASS uses a mottled six-color green palette.
- ROCK uses a dark irregular six-color neutral-gray palette.
- Each material is exactly `16 × 16` pixels.
- Every side, top, and bottom face of a GRASS block uses the same grass material.
- Every side, top, and bottom face of a ROCK block uses the same rock material.
- There is no dirt side texture or other face-specific material.
- There are no normal maps, PBR maps, shadows, ambient occlusion, animation, or texture mipmaps.

## Asset ownership and provenance

The grass and rock textures were designed from scratch for this repository as deterministic procedural pixel art. They were not copied, sampled, traced, recolored, or derived from Minecraft, Mojang, RubyDung, or another game. No external game texture file is loaded by the browser.

`web/block-textures.mjs` is the authoritative retained source for every texture pixel. It uses fixed original color palettes and deterministic cluster and grain rules. `tools/generate-block-textures.mjs` can regenerate standalone PNG previews from that same source:

```bash
node tools/generate-block-textures.mjs
```

The previews are written to the ignored `build/texture-previews/` directory. The browser generates the same pixels directly at startup, so preview images and gameplay cannot drift apart.

## Atlas and crisp sampling

The two `16 × 16` materials are packed into a small runtime atlas. Each tile is surrounded by a one-pixel gutter containing replicated edge pixels. UVs stay within the intended tile, preventing grass and rock from bleeding into one another at atlas boundaries.

WebGL uses:

- `NEAREST` minification filtering;
- `NEAREST` magnification filtering;
- `CLAMP_TO_EDGE` wrapping;
- no generated mipmap chain.

This preserves intentionally hard pixel edges while the player moves and at normal viewing distances.

## What appears on screen

After terrain, cave, and meshing progress finish, the player appears on grass beside a substantial cave entrance and initially faces the opening.

The rolling surface is now covered by a visibly mottled primitive green texture. Cave entrances, underground walls, floors, ceilings, and exposed world edges use a much darker irregular gray rock texture. The two blocks are immediately distinguishable, while all cube faces remain materially consistent.

The finite `256 × 64 × 256` world, sharp light-blue `#7FCCFF` sky, cave generation, collision, gravity, jumping, and seed query parameter remain active. Different seeds can be selected with a URL such as `?seed=42`.

## Browser controls

- Click the canvas: capture the mouse.
- Move the mouse: look left, right, up, and down.
- `W` / `S`: move forward / backward.
- `A` / `D`: strafe left / right.
- `Space`: jump while grounded.
- `Escape`: release the mouse; press again while released to stop and release graphics resources.

There is no flying, sprinting, crouching, swimming, or automatic step-up.

## Browser development

Requirements: a WebGL 2 browser, Node.js 24 for tests, and Python 3 or another static server.

```bash
node --test web/test/*.test.mjs
node tools/generate-block-textures.mjs
python3 -m http.server 8000
```

Open `http://localhost:8000/` or `http://localhost:8000/web/`.

## Phase 7 structure

- `web/block-textures.mjs`: original deterministic grass and rock pixel source.
- `web/atlas.mjs`: padded atlas construction and bleeding-safe UV bounds.
- `web/pixel-texture-sampling.mjs`: nearest-neighbor, no-mipmap texture policy.
- `tools/generate-block-textures.mjs`: retained deterministic PNG preview generator.
- `web/test/block-textures.test.mjs`: color, checksum, gutter, UV, face-material, sampling, and PNG tests.
- `web/test/browser-smoke.sh`: real Chromium validation of both GitHub Pages entry layouts.

## Desktop reference build

The Java/LWJGL desktop target remains a Phase 1 reference shell. The public Phase 7 implementation uses WebGL 2 because GitHub Pages cannot execute native LWJGL code.

```bash
./gradlew build
./gradlew test
./gradlew run
```

## Scope boundary

Phase 7 does not add lighting, shadows, ambient occlusion, PBR materials, animated textures, dirt, additional block types, block interaction, inventory, enemies, sound, or world saving.
