package dev.orscathinus.cavegame;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;

import org.joml.Vector3f;
import org.junit.jupiter.api.Test;
import org.lwjgl.Version;

class DependencyWiringTest {
    @Test
    void lwjglCoreIsAvailableWithoutCreatingAWindow() {
        assertFalse(Version.getVersion().isBlank());
    }

    @Test
    void jomlIsAvailableForFutureThreeDimensionalMath() {
        Vector3f vector = new Vector3f(1.0f, 2.0f, 3.0f);

        assertEquals(14.0f, vector.lengthSquared(), 0.0001f);
    }
}
