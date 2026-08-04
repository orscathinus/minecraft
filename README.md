# Cave Game Tech Test Recreation

A small, historically inspired recreation targeting the technical scope of the May 13, 2009 **Cave Game Tech Test**.

This is an independent educational recreation. It is not affiliated with Mojang or Microsoft, and it does not include copyrighted Minecraft textures, sounds, source code, or other assets.

## Play in a browser

**https://orscathinus.github.io/minecraft/**

The project supports GitHub Pages from `main` / repository root and through the GitHub Actions deployment of `web/`.

## Current status: Phase 6 cave generation

The browser build generates the deterministic finite world, carves primitive caves, builds cave-aware chunk meshes, and places the collision-enabled first-person player beside a surface cave entrance.

The cave pass runs after terrain generation and before meshing. It uses six seeded, curved random-walk tunnels made from overlapping spheres. Two tunnels connect through a shared pit, five begin at or break through the upper surface, and one tunnel descends to Y=1. Radius varies between approximately 1.20 and 2.25 blocks. Y=0 is never carved.

Caves contain only AIR removed from existing GRASS or ROCK. After carving, each column is rescanned: only its highest directly sky-exposed solid block may be GRASS, and only when that block remains within Y=57 through Y=63. Grass is not placed on deep cave floors or walls.

Every edited chunk is marked dirty. Edits on a chunk boundary also invalidate the neighboring chunk, so rebuilding does not leave duplicate or missing faces at seams.

## What appears on screen

After terrain, cave, and meshing progress finish, the application opens at normal first-person eye height on solid grass beside the nearest substantial cave opening. The player initially faces the entrance.

The user sees a dark, irregular pit or tunnel opening cut through the green surface. Walking forward allows the player to enter, descend, jump around cave passages, or fall into deeper sections. Interior walls use the same sharp placeholder rock texture. Some passages intersect, widen into small chambers, and continue toward the second-lowest world layer.

The finite rolling surface, light-blue `#7FCCFF` sky, player collision, gravity, jumping, and seed query parameter remain active. No player model is rendered.

## Browser controls

- Click the canvas: capture the mouse.
- Move the mouse: look left, right, up, and down.
- `W` / `S`: move forward / backward.
- `A` / `D`: strafe left / right.
- `Space`: jump while grounded.
- `Escape`: release the mouse; press again while released to stop and release graphics resources.

There is no flying, sprinting, crouching, swimming, or automatic step-up.

## World and seed

The world remains exactly X/Z `0..255` and Y `0..63`, divided into a `16 × 16` horizontal grid of 256 full-height chunks. The default seed is `1337`. Add an integer query parameter such as `?seed=42` to create a different deterministic terrain-and-cave layout.

For the default seed, the cave pass carves 4,171 blocks, opens 81 former surface-grass blocks, reaches Y=1, and marks 33 affected or neighboring chunks for remeshing.

## Browser development

Requirements: a WebGL 2 browser, Node.js 24 for tests, and Python 3 or another static server.

```bash
node --test web/test/*.test.mjs
python3 -m http.server 8000
```

Open `http://localhost:8000/` or `http://localhost:8000/web/`.

## Phase 6 structure

- `web/cave-generator.mjs`: seeded pit and sphere-worm carving, grass correction, and cave statistics.
- `web/world.mjs`: voxel editing plus dirty-chunk and boundary-neighbor invalidation.
- `web/app.mjs`: terrain, cave, meshing, cave-adjacent spawning, and first-person lifecycle.
- `web/test/cave-generator.test.mjs`: determinism, depth, bottom, block-set, sunlight-grass, seam, and invalidation tests.
- `web/test/browser-smoke.sh`: real Chromium validation of both GitHub Pages entry layouts.

## Desktop reference build

The Java/LWJGL desktop target remains a Phase 1 reference shell. The public Phase 6 implementation uses WebGL 2 because GitHub Pages cannot execute native LWJGL code.

```bash
./gradlew build
./gradlew test
./gradlew run
```

## Scope boundary

Phase 6 does not add ravines, aquifers, water, lava, ores, dungeons, biomes, block breaking, block placement, inventory, enemies, sound, or world saving.
