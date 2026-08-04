package dev.orscathinus.cavegame;

import dev.orscathinus.cavegame.app.Game;
import java.util.Arrays;
import java.util.logging.Level;
import java.util.logging.Logger;

/** Application entry point for the Cave Game Tech Test recreation. */
public final class Main {
    private static final Logger LOGGER = Logger.getLogger(Main.class.getName());
    private static final String SMOKE_TEST_ARGUMENT = "--smoke-test";

    private Main() {
    }

    public static void main(String[] args) {
        boolean smokeTest = Arrays.asList(args).contains(SMOKE_TEST_ARGUMENT);

        try {
            new Game(smokeTest).run();
        } catch (Throwable failure) {
            LOGGER.log(Level.SEVERE, "Cave Game failed to start or shut down cleanly.", failure);
            System.exit(1);
        }
    }
}
