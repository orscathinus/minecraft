package dev.orscathinus.cavegame;

/**
 * Compatibility entry point retained for older launch configurations.
 * New code should use {@link Main}.
 */
@Deprecated(forRemoval = false)
public final class CaveGame {
    private CaveGame() {
    }

    public static void main(String[] args) {
        Main.main(args);
    }
}
