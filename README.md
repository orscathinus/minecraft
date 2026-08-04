# Cave Game Tech Test Recreation

A small, historically inspired recreation targeting the technical scope of the May 13, 2009 **Cave Game Tech Test**.

This is an independent educational recreation. It is not affiliated with Mojang or Microsoft, and it does not include copyrighted Minecraft textures, sounds, source code, or other assets.

## Play in a browser

**https://orscathinus.github.io/minecraft/**

The project supports GitHub Pages from `main` / repository root and through the GitHub Actions deployment of `web/`.

## Current status: Phase 5 first-person player

The browser build generates the deterministic finite Phase 4 world and places a collision-enabled first-person player on its surface.

Player approximation:

- height: exactly `1.62` blocks;
- width: exactly `0.60` blocks;
- eye height: `1.54` blocks above the feet;
- axis-aligned bounding box;
- no visible player model.

The player uses gravity, grounded-only jumping, floor and ceiling collision, horizontal voxel collision, and independent X/Z resolution for wall sliding. GRASS and ROCK are solid; AIR is passable. Movement is simulated through the existing fixed 60-updates-per-second loop, so render-frame rate changes do not change movement or jumping.

## What appears on screen

After generation and meshing finish, the application opens from the player’s eye position near the center of the rolling grass world. The camera is close to the surface rather than flying above the map. The user can walk across grass, jump onto or over one-block height changes, collide with rock and grass blocks, and look around with the mouse.

The finite world, sharp placeholder textures, light-blue `#7FCCFF` sky, and seed query parameter remain unchanged. No player body is rendered in front of or behind the camera.

## Browser controls

- Click the canvas: capture the mouse.
- Move the mouse: look left, right, up, and down.
- `W` / `S`: move forward / backward.
- `A` / `D`: strafe left / right.
- `Space`: jump while grounded.
- `Escape`: release the mouse; press again while released to stop and release graphics resources.

There is no flying, sprinting, crouching, swimming, or automatic step-up.

## World and seed

The finite world remains exactly X/Z `0..255` and Y `0..63`, divided into a `16 × 16` horizontal grid of 256 full-height chunks. The default seed is `1337`. Add an integer query parameter such as `?seed=42` to create a different deterministic landscape.

## Browser development

Requirements: a WebGL 2 browser, Node.js 24 for tests, and Python 3 or another static server.

```bash
node --test web/test/*.test.mjs
python3 -m http.server 8000
```

Open `http://localhost:8000/` or `http://localhost:8000/web/`.

## Phase 5 structure

- `web/aabb.mjs`: reusable AABB construction and intersection tests.
- `web/player-physics.mjs`: player dimensions, gravity, jumping, voxel collision, and wall sliding.
- `web/first-person-player.mjs`: keyboard, pointer-lock, mouse-look, and focus-reset handling.
- `web/app.mjs`: fixed-step player updates and first-person rendering.
- `web/test/player-physics.test.mjs`: focused floor, ceiling, wall, sliding, grounding, and frame-rate tests.

## Desktop reference build

The Java/LWJGL desktop target remains a Phase 1 reference shell. The public Phase 5 implementation uses WebGL 2 because GitHub Pages cannot execute native LWJGL code.

```bash
./gradlew build
./gradlew test
./gradlew run
```

## Scope boundary

Phase 5 does not add caves, block breaking, block placement, inventory, crouching, sprinting, swimming, step-up, a player model, enemies, sound, or world saving.
