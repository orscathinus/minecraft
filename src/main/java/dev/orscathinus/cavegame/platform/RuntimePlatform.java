package dev.orscathinus.cavegame.platform;

import java.util.Locale;
import java.util.Objects;

/**
 * The small set of desktop runtime targets supported by the prototype.
 */
public record RuntimePlatform(OperatingSystem operatingSystem, Architecture architecture) {
    public RuntimePlatform {
        Objects.requireNonNull(operatingSystem, "operatingSystem");
        Objects.requireNonNull(architecture, "architecture");
    }

    public static RuntimePlatform current() {
        return detect(System.getProperty("os.name"), System.getProperty("os.arch"));
    }

    public static RuntimePlatform detect(String osName, String osArch) {
        String normalizedOs = normalize(osName, "osName");
        String normalizedArch = normalize(osArch, "osArch");

        OperatingSystem operatingSystem;
        // Darwin contains the substring "win", so macOS must be checked first.
        if (normalizedOs.contains("mac") || normalizedOs.contains("darwin")) {
            operatingSystem = OperatingSystem.MACOS;
        } else if (normalizedOs.contains("win")) {
            operatingSystem = OperatingSystem.WINDOWS;
        } else if (normalizedOs.contains("linux")) {
            operatingSystem = OperatingSystem.LINUX;
        } else {
            throw new IllegalArgumentException("Unsupported operating system: " + osName);
        }

        Architecture architecture;
        if (normalizedArch.equals("amd64")
                || normalizedArch.equals("x86_64")
                || normalizedArch.equals("x64")) {
            architecture = Architecture.X64;
        } else if (normalizedArch.equals("aarch64") || normalizedArch.equals("arm64")) {
            architecture = Architecture.ARM64;
        } else {
            throw new IllegalArgumentException("Unsupported architecture: " + osArch);
        }

        return new RuntimePlatform(operatingSystem, architecture);
    }

    public String lwjglNativesClassifier() {
        return switch (operatingSystem) {
            case WINDOWS -> architecture == Architecture.ARM64
                    ? "natives-windows-arm64"
                    : "natives-windows";
            case LINUX -> architecture == Architecture.ARM64
                    ? "natives-linux-arm64"
                    : "natives-linux";
            case MACOS -> architecture == Architecture.ARM64
                    ? "natives-macos-arm64"
                    : "natives-macos";
        };
    }

    public String displayName() {
        return operatingSystem.displayName + " " + architecture.displayName;
    }

    private static String normalize(String value, String parameterName) {
        Objects.requireNonNull(value, parameterName);
        String normalized = value.strip().toLowerCase(Locale.ROOT);
        if (normalized.isEmpty()) {
            throw new IllegalArgumentException(parameterName + " must not be blank");
        }
        return normalized;
    }

    public enum OperatingSystem {
        WINDOWS("Windows"),
        LINUX("Linux"),
        MACOS("macOS");

        private final String displayName;

        OperatingSystem(String displayName) {
            this.displayName = displayName;
        }
    }

    public enum Architecture {
        X64("x64"),
        ARM64("ARM64");

        private final String displayName;

        Architecture(String displayName) {
            this.displayName = displayName;
        }
    }
}
