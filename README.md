# Cave Game Tech Test Recreation

A small, historically inspired recreation targeting the technical scope of the May 13, 2009 **Cave Game Tech Test**.

This is an independent educational recreation. It is not affiliated with Mojang or Microsoft, and it does not include copyrighted Minecraft textures, sounds, source code, or other assets.

## Play in a browser

**https://orscathinus.github.io/minecraft/**

The project supports GitHub Pages from `main` / repository root and through the GitHub Actions deployment of `web/`.

## Current status: Phase 8 BRIGHT / DARK lighting

The browser build keeps the finite seeded world, primitive caves, collision-enabled first-person player, and original Phase 7 textures. Chunk geometry now contains one binary sunlight value per visible face:

- `BRIGHT` (`1`): the first opaque block reached when scanning a column downward from Y=63;
- `DARK` (`0`): every opaque block below that first hit.

AIR does not stop sunlight. An opaque GRASS or ROCK block stops it for every lower block in that X/Z column. A block at Y=63 is BRIGHT when it is the first opaque block. There are no torches, colored lights, sideways flood fill, smooth lighting, day/night cycles, or dynamic shadows.

## Chunk-level sunlight data

`web/sunlight.mjs` stores one signed byte for each of the world’s 65,536 X/Z columns. The byte records the highest opaque Y coordinate, or `-1` for a completely empty column. This cache is built after terrain and cave generation and before chunk meshing.

World edits mark their X/Z column dirty. Before affected chunk meshes are rebuilt, only those dirty sunlight columns are rescanned. Existing chunk-boundary invalidation remains active, so changed boundary blocks rebuild both adjoining chunks.

No world-sized raycast occurs in the fragment shader. The mesher resolves each block to BRIGHT or DARK once and writes that binary state into the existing sixth vertex attribute.

## Rendering model

BRIGHT geometry receives full texture color. DARK geometry receives one fixed brightness level of `0.28`, regardless of how far it is from sunlight.

Only DARK geometry receives heavy black distance fog:

- fog begins at 4 blocks from the camera;
- it reaches its maximum at 30 blocks;
- it uses five intentionally crude distance steps;
- maximum black fog strength is 0.96.

BRIGHT outdoor geometry does not receive this aggressive cave fog. The clear-sky color remains exactly `#7FCCFF`.

This is deliberately not a modern lighting engine. It has no smooth-light interpolation, ambient occlusion, shadow map, light propagation, emissive blocks, or colored illumination.

## What appears on screen

After terrain generation, cave carving, sunlight calculation, and meshing finish, the player appears beside a substantial cave entrance and initially faces it.

The rolling outdoor grass surface is fully bright beneath the light-blue sky. Rock and grass covered by another opaque block are immediately and consistently dim. Entering a cave produces a harsh transition from the bright entrance to dark interior geometry. Nearby cave walls remain faintly visible; walls farther down a passage become progressively blacker because of the stepped dark-only fog.

A vertical pit can carry sunlight down through AIR until the first solid floor block. Cave rooms under an intact rock roof remain DARK even when they are close to the surface.

The finite `256 × 64 × 256` world, deterministic seeds, player collision, gravity, jumping, caves, and original crisp textures remain active. Add an integer such as `?seed=42` to the URL for a different deterministic terrain-and-cave layout.

## Original texture ownership

The `16 × 16` grass and rock textures were designed from scratch for this repository as deterministic procedural pixel art. They were not copied, sampled, traced, recolored, or derived from Minecraft, Mojang, RubyDung, or another game.

`web/block-textures.mjs` is the authoritative pixel source. The atlas uses replicated one-pixel gutters, `NEAREST` filtering, `CLAMP_TO_EDGE`, and no mipmaps.

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

## Phase 8 structure

- `web/sunlight.mjs`: compact column sunlight cache, BRIGHT/DARK states, and relighting.
- `web/world.mjs`: dirty lighting-column and dirty chunk tracking.
- `web/chunk-mesher.mjs`: binary light-state encoding in visible chunk faces.
- `web/world-mesh.mjs`: full-world and dirty-chunk sunlight-aware mesh rebuilding.
- `web/shaders/block.vert.glsl`: passes binary state and camera distance.
- `web/shaders/block.frag.glsl`: fixed dim cave light and stepped black fog.
- `web/test/sunlight.test.mjs`: focused sunlight, roof, Y=63, cave-opening, and relighting tests.
- `web/test/browser-smoke.sh`: real Chromium validation of both GitHub Pages entry layouts.

## Desktop reference build

The Java/LWJGL desktop target remains a Phase 1 reference shell. The public Phase 8 implementation uses WebGL 2 because GitHub Pages cannot execute native LWJGL code.

```bash
./gradlew build
./gradlew test
./gradlew run
```

## Scope boundary

Phase 8 does not add torches, colored or flood-filled light, smooth lighting, shadows, ambient occlusion, day/night cycles, water, lava, additional blocks, block interaction, inventory, enemies, sound, or world saving.
