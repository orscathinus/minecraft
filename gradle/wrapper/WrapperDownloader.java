import java.io.IOException;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URI;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;

/** Downloads and verifies the official Gradle 9.6.1 wrapper bootstrap JAR. */
public final class WrapperDownloader {
    private static final URI WRAPPER_URI = URI.create(
            "https://raw.githubusercontent.com/gradle/gradle/v9.6.1/gradle/wrapper/gradle-wrapper.jar"
    );
    private static final String EXPECTED_SHA_256 =
            "497c8c2a7e5031f6aa847f88104aa80a93532ec32ee17bdb8d1d2f67a194a9c7";

    private WrapperDownloader() {
    }

    public static void main(String[] args) throws Exception {
        Path target = Path.of("gradle", "wrapper", "gradle-wrapper.jar").toAbsolutePath();
        Files.createDirectories(target.getParent());

        if (Files.exists(target) && EXPECTED_SHA_256.equals(sha256(target))) {
            return;
        }

        Path temporary = Files.createTempFile(target.getParent(), "gradle-wrapper-", ".jar");
        try {
            download(WRAPPER_URI, temporary);
            String actual = sha256(temporary);
            if (!EXPECTED_SHA_256.equals(actual)) {
                throw new SecurityException(
                        "Gradle wrapper checksum mismatch. Expected "
                                + EXPECTED_SHA_256 + " but received " + actual
                );
            }
            Files.move(temporary, target, StandardCopyOption.REPLACE_EXISTING);
        } finally {
            Files.deleteIfExists(temporary);
        }
    }

    private static void download(URI uri, Path target) throws IOException {
        HttpURLConnection connection = (HttpURLConnection) uri.toURL().openConnection();
        connection.setInstanceFollowRedirects(true);
        connection.setConnectTimeout(15_000);
        connection.setReadTimeout(30_000);
        connection.setRequestProperty("User-Agent", "cave-game-gradle-wrapper-bootstrap");

        int status = connection.getResponseCode();
        if (status < 200 || status >= 300) {
            throw new IOException("Wrapper download failed with HTTP status " + status);
        }

        try (InputStream input = connection.getInputStream()) {
            Files.copy(input, target, StandardCopyOption.REPLACE_EXISTING);
        } finally {
            connection.disconnect();
        }
    }

    private static String sha256(Path path) throws IOException, NoSuchAlgorithmException {
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        try (InputStream input = Files.newInputStream(path)) {
            byte[] buffer = new byte[8192];
            int read;
            while ((read = input.read(buffer)) >= 0) {
                digest.update(buffer, 0, read);
            }
        }
        return HexFormat.of().formatHex(digest.digest());
    }
}
