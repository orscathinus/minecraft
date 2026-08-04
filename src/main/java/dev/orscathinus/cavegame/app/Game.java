package dev.orscathinus.cavegame.app;

import static org.lwjgl.glfw.GLFW.GLFW_KEY_ESCAPE;

import dev.orscathinus.cavegame.input.InputState;
import dev.orscathinus.cavegame.render.Window;
import dev.orscathinus.cavegame.util.FixedStepTimer;
import java.util.logging.Logger;

/** Owns the application lifecycle and fixed-update/render loop. */
public final class Game {
    private static final Logger LOGGER = Logger.getLogger(Game.class.getName());

    private static final String WINDOW_TITLE = "Cave Game Tech Test Recreation";
    private static final int WINDOW_WIDTH = 1280;
    private static final int WINDOW_HEIGHT = 720;
    private static final double UPDATES_PER_SECOND = 60.0;
    private static final double MAX_FRAME_DELTA_SECONDS = 0.25;
    private static final int MAX_UPDATES_PER_FRAME = 5;
    private static final int SMOKE_TEST_RENDER_FRAMES = 8;

    private final boolean smokeTest;

    private Window window;
    private InputState input;

    public Game(boolean smokeTest) {
        this.smokeTest = smokeTest;
    }

    public void run() {
        try {
            initialize();
            gameLoop();
        } finally {
            close();
        }
    }

    private void initialize() {
        LOGGER.info("Starting Phase 1 application foundation.");

        window = new Window(WINDOW_TITLE, WINDOW_WIDTH, WINDOW_HEIGHT, true, smokeTest);
        window.open();

        input = new InputState();
        input.attach(window.handle());
    }

    private void gameLoop() {
        FixedStepTimer timer = new FixedStepTimer(
                UPDATES_PER_SECOND,
                MAX_FRAME_DELTA_SECONDS,
                MAX_UPDATES_PER_FRAME
        );
        timer.reset(window.timeSeconds());

        int renderedFrames = 0;
        while (!window.shouldClose()) {
            window.pollEvents();

            FixedStepTimer.Frame frame = timer.advance(window.timeSeconds());
            for (int updateIndex = 0; updateIndex < frame.updateCount(); updateIndex++) {
                update(timer.stepSeconds());
            }

            render(frame.interpolationAlpha());
            window.swapBuffers();

            if (smokeTest && ++renderedFrames >= SMOKE_TEST_RENDER_FRAMES) {
                window.requestClose();
            }
        }
    }

    private void update(double stepSeconds) {
        // stepSeconds is intentionally accepted now so later simulation code cannot
        // accidentally depend on render timing.
        if (stepSeconds <= 0.0) {
            throw new IllegalStateException("Fixed update duration must be positive");
        }

        if (input.isKeyDown(GLFW_KEY_ESCAPE)) {
            window.requestClose();
        }
    }

    private void render(double interpolationAlpha) {
        // Rendering is intentionally independent of the number of fixed updates.
        // The interpolation value is reserved for future moving entities.
        if (interpolationAlpha < 0.0 || interpolationAlpha >= 1.0) {
            throw new IllegalStateException("Interpolation alpha must be in [0, 1)");
        }
        window.clear();
    }

    private void close() {
        if (input != null) {
            input.close();
            input = null;
        }
        if (window != null) {
            window.close();
            window = null;
        }
        LOGGER.info("Cave Game shut down cleanly.");
    }
}
