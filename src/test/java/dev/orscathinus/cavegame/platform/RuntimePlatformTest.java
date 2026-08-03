package dev.orscathinus.cavegame.platform;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import org.junit.jupiter.api.Test;

class RuntimePlatformTest {
    @Test
    void detectsWindowsX64() {
        RuntimePlatform platform = RuntimePlatform.detect("Windows 11", "amd64");

        assertEquals("Windows x64", platform.displayName());
        assertEquals("natives-windows", platform.lwjglNativesClassifier());
    }

    @Test
    void detectsWindowsArm64() {
        RuntimePlatform platform = RuntimePlatform.detect("Windows 11", "aarch64");

        assertEquals("natives-windows-arm64", platform.lwjglNativesClassifier());
    }

    @Test
    void detectsLinuxX64() {
        RuntimePlatform platform = RuntimePlatform.detect("Linux", "x86_64");

        assertEquals("natives-linux", platform.lwjglNativesClassifier());
    }

    @Test
    void detectsLinuxArm64() {
        RuntimePlatform platform = RuntimePlatform.detect("Linux", "arm64");

        assertEquals("natives-linux-arm64", platform.lwjglNativesClassifier());
    }

    @Test
    void detectsMacOsX64() {
        RuntimePlatform platform = RuntimePlatform.detect("Mac OS X", "x86_64");

        assertEquals("natives-macos", platform.lwjglNativesClassifier());
    }

    @Test
    void detectsDarwinAsMacOsInsteadOfWindows() {
        RuntimePlatform platform = RuntimePlatform.detect("Darwin", "aarch64");

        assertEquals("natives-macos-arm64", platform.lwjglNativesClassifier());
    }

    @Test
    void rejectsUnsupportedOperatingSystem() {
        assertThrows(
                IllegalArgumentException.class,
                () -> RuntimePlatform.detect("Plan 9", "amd64")
        );
    }

    @Test
    void rejectsUnsupportedArchitecture() {
        assertThrows(
                IllegalArgumentException.class,
                () -> RuntimePlatform.detect("Linux", "riscv64")
        );
    }
}
