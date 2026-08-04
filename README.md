# Cave Game Tech Test Recreation

A small, historically inspired recreation targeting the technical scope of the May 13, 2009 **Cave Game Tech Test**.

This is an independent educational recreation. It is not affiliated with Mojang or Microsoft, and it does not include copyrighted Minecraft textures, sounds, source code, or other assets.

## Play in a browser

**https://orscathinus.github.io/minecraft/**

The project supports GitHub Pages from `main` / repository root and through the GitHub Actions deployment of `web/`.

## Current status: Phase 2 browser voxel renderer

The browser build now renders two indexed voxel cubes through WebGL 2:

- one grass cube and one rock cube;
- an original generated `32 × 16` atlas containing two `16 × 16` textures;
- the same material texture on all six faces of each cube;
- nearest-neighbor filtering for sharp pixels;
- perspective projection that responds to resizing;
- a temporary movable debug camera;
- depth testing and back-face culling;
- resource-file vertex and fragment shaders;
- position, texture-coordinate, and brightness attributes;
- one combined mesh and one draw call for both cubes;
- explicit cleanup of vertex arrays, buffers, programs, shaders, and textures.

There is still **no terrain, collision, caves, chunk generation, player physics, breaking, or placement**.

## Browser controls

- Click the canvas: capture the mouse.
- Mouse or arrow keys: rotate the debug camera.
- `W`, `A`, `S`, `D`: move.
- `Q` / `E`: move down / up.
- Hold `Shift`: move faster.
- `Escape`: release the mouse; press again to stop and release graphics resources.

## What appears on screen

The application opens against the light-blue `#7FCCFF` sky. A green grass-textured cube and a gray rock-textured cube appear side by side. Moving or rotating the debug camera reveals every side, with modest face brightness differences making cube orientation easy to inspect. The original placeholder texture pixels remain crisp rather than blurred.

## Browser development

Requirements: a WebGL 2 browser, Node.js 24 for tests, and Python 3 or another static server.

```bash
node --test web/test/*.test.mjs
python3 -m http.server 8000
```

Open `http://localhost:8000/` or `http://localhost:8000/web/`.

## Browser renderer structure

- `web/renderer.mjs`: shader program, atlas texture, VAO/VBO/EBO, draw, and disposal lifecycle.
- `web/mesh.mjs`: reusable aggregate mesh data suitable for later chunk meshes.
- `web/atlas.mjs`: original atlas pixels and tile-coordinate calculations.
- `web/debug-camera.mjs`: temporary Phase 2 camera controls.
- `web/math.mjs`: perspective and view matrices.
- `web/shaders/`: GLSL ES 3.00 shader resources.

## Desktop reference build

The Java/LWJGL desktop target remains a Phase 1 reference shell. The public Phase 2 renderer is implemented in WebGL 2 because GitHub Pages cannot execute native LWJGL code.

```bash
./gradlew build
./gradlew test
./gradlew run
```

## Project documents

- [`SPEC.md`](SPEC.md)
- [`ASSUMPTIONS.md`](ASSUMPTIONS.md)
- [`ROADMAP.md`](ROADMAP.md)
- [`WEB_TARGET.md`](WEB_TARGET.md)

## Non-goals

Mining, placement, inventory, mobs, crafting, survival systems, sound, multiplayer, and world saving remain explicitly excluded.
