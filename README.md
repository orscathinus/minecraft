# Cave Game Tech Test Recreation

A small, independently developed recreation of the technical scope documented for the May 13, 2009 **Cave game tech test**.

This project is not affiliated with Mojang, Microsoft, or Markus Persson. It contains no copied Minecraft source code, textures, sounds, or other game assets.

## Play in a browser

**https://orscathinus.github.io/minecraft/**

The complete public implementation uses HTML, JavaScript modules, WebGL 2, and GitHub Pages. No server-side runtime or installation is required.

## Final scope

- Exact finite world: `256 × 64 × 256` blocks.
- Exact horizontal chunk grid: `16 × 16` chunks, each `16 × 64 × 16` blocks.
- Only three block states: `AIR`, `GRASS`, and `ROCK`.
- Original 16×16 grass and rock textures; one material on all six faces.
- Grass only on directly sunlit exposed terrain in Y `57..63`.
- Deterministic restrained terrain and surface-opening caves that can reach Y `1`.
- Uncarvable solid Y `0` layer.
- First-person player with a `0.60 × 1.62 × 0.60` collision box and no rendered model.
- Binary BRIGHT/DARK sunlight and heavy stepped black fog on DARK geometry.
- Exact clear-sky color `#7FCCFF`.
- Nearby-first incremental chunk meshing and upload.
- Random X/Z spawning at exactly Y `74`.
- Held-R respawning every fixed 60 Hz update.
- Non-lethal, non-resetting void behavior.
- No mining, placement, inventory, crafting, mobs, health, sound, saving, multiplayer, or later-game content.

The authoritative requirements are in [`SPEC.md`](SPEC.md). Reconstruction choices are separated into [`ASSUMPTIONS.md`](ASSUMPTIONS.md), and unresolved historical differences are listed in [`KNOWN_DEVIATIONS.md`](KNOWN_DEVIATIONS.md).

## Controls

| Input | Action |
|---|---|
| Click | Capture the mouse |
| Mouse | Look around |
| W / S | Move forward / backward |
| A / D | Strafe left / right |
| Space | Jump while grounded |
| Hold R | Select a new random X/Z and respawn at Y=74 every fixed update |
| F3 | Toggle diagnostics |
| H | Toggle normal and historical chunk-loading pace |
| Escape | Release mouse; press again while released to stop and dispose resources |

There are no controls for breaking or placing blocks.

## What appears on screen

After deterministic terrain, cave, and sunlight preparation, the player starts above a random block column with feet at Y `74`. The spawn chunk appears first, and nearby chunks spread outward before distant chunks. Outdoor terrain is bright; covered caves are uniformly dim and become blacker with distance. The player may walk beyond the finite map or fall below Y `0` without damage, death, or automatic respawn. Holding R remains the manual way to return above the map.

Normal mode uses a practical two-chunks-per-frame mesh budget. Historical-loading mode processes one chunk every ten frames so the documented proximity order remains visible:

```text
https://orscathinus.github.io/minecraft/?loading=historical&debugChunks=1
```

## Screenshots

| Scene | File |
|---|---|
| Surface | [`docs/screenshots/surface.png`](docs/screenshots/surface.png) |
| Cave | [`docs/screenshots/cave.png`](docs/screenshots/cave.png) |
| Historical chunk loading | [`docs/screenshots/chunk-loading.png`](docs/screenshots/chunk-loading.png) |
| Void | [`docs/screenshots/void.png`](docs/screenshots/void.png) |

These images are captured from the actual WebGL 2 application with deterministic test seeds and ordinary runtime controls.

## Historical sources and evidence policy

The original executable was not publicly released, so the reconstruction uses surviving video, contemporaneous posts/logs as summarized by historical references, and the requirements preserved in this repository.

Primary reference links:

- [Archived “Cave Game tech demo!” post from The Word of Notch, May 13, 2009](https://blog.omniarchive.uk/post/107315028/cave-game-tech-demo/)
- [Minecraft Wiki: Java Edition pre-Classic rd-131655 / Cave game tech test](https://minecraft.wiki/w/Java_Edition_pre-Classic_rd-131655)
- [`SPEC.md`](SPEC.md), the project’s frozen engineering interpretation of the evidence

The historical references support broad facts such as the `256 × 64 × 256` map, 16×16 horizontal chunks, slow proximity-ordered chunk updates, the three early materials, top-layer lit grass, non-interactive blocks, R respawning, caves, and the void. They do not reveal all algorithms or constants. Unknown details are explicitly labeled approximations rather than presented as recovered facts.

## Asset ownership

The grass and rock textures were designed from scratch for this repository as deterministic procedural pixel art. They were not copied, traced, sampled, recolored, or derived from Minecraft, Mojang, RubyDung, or another game.

- Authoritative source: `web/block-textures.mjs`
- Resolution: 16×16 RGBA per material
- Sampling: nearest-neighbor
- Mipmaps: disabled
- Atlas protection: replicated one-pixel gutters
- Material rule: one texture on every face of each block

The retained preview tool is:

```bash
node tools/generate-block-textures.mjs
```

## Browser development

Requirements: Node.js 24 for the complete verification toolchain, Python 3 or another static server, and a WebGL 2 browser.

```bash
node tools/fidelity-audit.mjs
node tools/benchmark-web.mjs --json
node --test web/test/*.test.mjs
python3 -m http.server 8000
```

Open `http://localhost:8000/` or `http://localhost:8000/web/`.

## Desktop Gradle reference and distribution

The Java 21/LWJGL 3/OpenGL desktop application remains a small reference shell. The Gradle distribution packages that desktop launcher together with the complete browser build, documentation, reports, and screenshots.

### Windows

1. Install a 64-bit JDK 21 and verify `java -version`.
2. Open PowerShell in the repository.
3. Run:

```powershell
.\gradlew.bat clean build
.\gradlew.bat finalPackage
```

The ZIP and TAR packages appear in `build/distributions/`. A platform-native Windows LWJGL runtime is selected during the Windows build.

### macOS

Install JDK 21, then run:

```bash
./gradlew clean build
./gradlew finalPackage
```

Gradle selects Intel or Apple-silicon LWJGL natives from the current machine. The generated launcher includes `-XstartOnFirstThread` as required by GLFW on macOS.

### Linux

Install JDK 21 and the system libraries needed by GLFW/OpenGL, then run:

```bash
./gradlew clean build
./gradlew finalPackage
```

For a headless CI smoke test, use Xvfb:

```bash
xvfb-run -a ./gradlew --no-daemon smokeTest
```

### Running the installed desktop reference

After `./gradlew installDist`:

```bash
./build/install/cave-game-tech-test-recreation/bin/cave-game-tech-test-recreation
```

On Windows, use the corresponding `.bat` launcher.

## Final verification

```bash
node tools/fidelity-audit.mjs
node tools/benchmark-web.mjs --json
node --test web/test/*.test.mjs
./gradlew --no-daemon clean build
./gradlew --no-daemon distZip distTar
bash web/test/browser-smoke.sh
```

The final verification matrix and scope audit are recorded in [`FINAL_TEST_REPORT.md`](FINAL_TEST_REPORT.md).

## Repository map

- `web/`: complete GitHub Pages/WebGL 2 application
- `src/`: Java/LWJGL reference target
- `tools/fidelity-audit.mjs`: repository-wide final-scope audit
- `tools/benchmark-web.mjs`: deterministic performance benchmark
- `tools/capture-screenshots.mjs`: deterministic real-browser screenshot capture
- `docs/screenshots/`: final surface, cave, loading, and void captures
- `SPEC.md`: required behavior and prohibited scope
- `ASSUMPTIONS.md`: implementation approximations
- `KNOWN_DEVIATIONS.md`: known differences from the unreleased historical build
- `FINAL_TEST_REPORT.md`: final validation report

## License and trademark note

This repository is an independent educational project. “Minecraft” and related marks belong to their respective owners. The project name describes the historical subject of study and does not imply endorsement.
