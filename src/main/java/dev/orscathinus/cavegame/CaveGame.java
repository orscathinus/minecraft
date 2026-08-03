package dev.orscathinus.cavegame;

import dev.orscathinus.cavegame.platform.RuntimePlatform;

/**
 * Pre-Phase 0 command-line entry point.
 *
 * <p>No window, renderer, world, or gameplay is created in this bootstrap phase.</p>
 */
public final class CaveGame {
    private CaveGame() {
    }

    public static void main(String[] args) {
        RuntimePlatform platform = RuntimePlatform.current();

        System.out.println("Cave Game Tech Test recreation: pre-Phase 0 bootstrap");
        System.out.printf("Runtime platform: %s%n", platform.displayName());
        System.out.printf("LWJGL native classifier: %s%n", platform.lwjglNativesClassifier());
        System.out.println("No graphical window or gameplay is implemented yet.");
    }
}
