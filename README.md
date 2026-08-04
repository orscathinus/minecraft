# Cave Game Tech Test Recreation

A small, historically inspired recreation targeting the technical scope of the May 13, 2009 **Cave Game Tech Test**.

This is an independent educational recreation. It is not affiliated with Mojang or Microsoft, and it does not include copyrighted Minecraft textures, sounds, source code, or other assets.

## Play in a browser

**https://orscathinus.github.io/minecraft/**

The public implementation uses WebGL 2 and runs from GitHub Pages with no server-side runtime.

## Current status: Phase 10 historical spawning and void behavior

The finite world remains exactly `256 × 64 × 256`, with block coordinates X/Z `0..255` and Y `0..63`. The player now uses the historically documented spawn rule instead of a safe terrain search.

### Initial spawn

At startup:

- a random X block coordinate from `0` through `255` is selected;
- a random Z block coordinate from `0` through `255` is selected;
- the player is placed at the center of those blocks, producing X/Z values from `0.5` through `255.5`;
- the player's feet are placed at exactly Y=`74`;
- horizontal and vertical velocity begin at zero;
- no attempt is made to find grass, avoid a cave, or find safe ground.

The initial camera faces generally toward the middle of the world and downward so the terrain is visible while the player falls from Y=74.

### Deterministic debug spawning

By default, the browser obtains one unpredictable 32-bit session seed and then uses a deterministic linear-congruential sequence for the initial spawn and every later respawn.

Supply a fixed debug seed to reproduce the exact spawn sequence:

```text
https://orscathinus.github.io/minecraft/?spawnSeed=12345
```

The terrain seed remains separate and can still be selected with `?seed=42`.

## Hold R to respawn

`R` is a held-state control, not a one-shot key action.

Every fixed 60 Hz game update during which R remains held:

1. selects a new random X/Z block center;
2. places the player's feet at exactly Y=74;
3. sets X, Y, and Z velocity to zero;
4. leaves yaw and pitch unchanged;
5. returns without applying gravity or movement during that update.

This intentionally produces rapid repeated teleportation. Releasing R stops the respawns immediately, and gravity resumes on the next fixed update. There is no cooldown, checkpoint, safe-spawn search, health system, death screen, damage, or life counter.

R remains functional while the player is outside the horizontal map or extremely far below it.

## Void behavior

The world does not have invisible horizontal boundary walls. Blocks outside the finite X/Z range and below Y=0 are treated as AIR for collision purposes.

Therefore:

- the player may walk beyond X/Z `0..256`;
- the player may fall below Y=0;
- crossing below Y=0 does not cause damage, death, or automatic respawn;
- gravity continues and there is no lower-Y gameplay clamp;
- the player remains in the void until R is used.

The existing terminal falling speed remains `50` blocks per second. This limits velocity but does not clamp position or return the player to the map.

### Extreme floating-point safeguard

Only at an extreme coordinate magnitude above `1,000,000,000,000` does a numerical safeguard activate. The affected coordinate is rebased to the same-sign magnitude `1,000,000,000`.

This safeguard exists solely to prevent floating-point precision corruption after an unrealistically long fall or journey. It does not place the player at Y=74, does not count as a respawn, does not return the player to the finite world, and preserves continued void behavior. In ordinary play it is unreachable.

## Proximity-ordered chunks

The world is a `16 × 16` grid of chunks, each covering `16 × 64 × 16` blocks. The player's current finite-grid priority anchor is recalculated continuously. When the player is outside the map, the anchor is clamped to the nearest edge chunk.

Unfinished chunks are ordered by squared horizontal distance, then chunk Z, then chunk X. The player's spawn chunk is uploaded before the first playable frame.

- Normal mode processes at most two chunks per animation frame.
- Historical-loading mode processes one chunk every ten frames.

Use `?loading=historical` or press `H` to observe the slower nearest-first loading. Press `F3` or use `?debugChunks=1` for the optional chunk/spawn overlay.

## What appears on screen

After terrain, cave, and sunlight preparation, the camera appears in the sky at a random X/Z location with the player's feet at Y=74. The nearby chunk is already visible below. The player falls under gravity and normally lands on the rolling surface, though a random cave opening can allow a longer fall.

Holding R makes the view jump rapidly between random positions above the map. Each teleport starts at the same Y=74 height with zero velocity. Releasing R stops the rapid teleportation.

Walking off the finite land mass or falling through a cave into the void does not open a death screen or move the player automatically. The sky and world recede above as the fall continues. Pressing R remains the manual way to return above the map.

The existing visuals remain active:

- exact clear-sky color `#7FCCFF`;
- original crisp `16 × 16` grass and rock textures;
- bright outdoor surfaces;
- fixed dim cave geometry with heavy dark-only distance fog;
- deterministic terrain and cave generation;
- collision, gravity, jumping, and nearest-first chunk processing;
- no visible player model.

## Browser controls

- Click: capture the mouse.
- Mouse: look around.
- `W` / `S`: move forward / backward.
- `A` / `D`: strafe.
- `Space`: jump while grounded.
- Hold `R`: respawn every fixed game update.
- `F3`: toggle the chunk/spawn debug overlay.
- `H`: switch normal and historical chunk loading.
- `Escape`: release the mouse; press again while released to stop and release graphics resources.

## Original texture ownership

The `16 × 16` grass and rock textures were designed from scratch for this repository as deterministic procedural pixel art. They were not copied, sampled, traced, recolored, or derived from Minecraft, Mojang, RubyDung, or another game.

`web/block-textures.mjs` is the authoritative pixel source. The atlas uses replicated one-pixel gutters, `NEAREST` filtering, `CLAMP_TO_EDGE`, and no mipmaps.

## Browser development

Requirements: a WebGL 2 browser, Node.js 24 for tests, and Python 3 or another static server.

```bash
node --test web/test/*.test.mjs
node tools/generate-block-textures.mjs
python3 -m http.server 8000
```

Open `http://localhost:8000/` or `http://localhost:8000/web/`.

## Phase 10 structure

- `web/spawn-controller.mjs`: deterministic spawn sequence, fixed Y=74 positions, and held-state respawning.
- `web/player-physics.mjs`: three-axis velocity state, explicit respawn reset, unrestricted void falling, and the extreme-coordinate safeguard.
- `web/first-person-player.mjs`: held R keyboard state evaluated on every fixed update.
- `web/app.mjs`: random initial spawn, spawn metadata, and chunk reprioritization after teleports.
- `web/test/spawn-controller.test.mjs`: deterministic spawn, range, velocity-reset, held-state, and far-below respawn tests.
- `web/test/player-physics.test.mjs`: below-Y=0, horizontal escape, respawn, and extreme-safeguard tests.
- `web/test/browser-smoke.sh`: real Chromium validation of both GitHub Pages entry layouts.

## Desktop reference build

The Java/LWJGL desktop target remains a Phase 1 reference shell. The public Phase 10 implementation uses WebGL 2 because GitHub Pages cannot execute native LWJGL code.

```bash
./gradlew build
./gradlew test
./gradlew run
```

## Scope boundary

Phase 10 does not add health, damage, death screens, lives, checkpoints, safe-spawn searching, cooldowns, infinite terrain, chunk unloading, block interaction, inventory, enemies, sound, water, lava, or persistence.
