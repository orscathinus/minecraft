#!/bin/sh

set -eu
APP_HOME=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
WRAPPER_JAR="$APP_HOME/gradle/wrapper/gradle-wrapper.jar"
DOWNLOADER="$APP_HOME/gradle/wrapper/WrapperDownloader.java"

if [ -n "${JAVA_HOME:-}" ]; then
    JAVA_COMMAND="$JAVA_HOME/bin/java"
else
    JAVA_COMMAND=java
fi

if ! command -v "$JAVA_COMMAND" >/dev/null 2>&1 && [ ! -x "$JAVA_COMMAND" ]; then
    echo "ERROR: Java 21 is required and no java executable was found." >&2
    exit 1
fi

if [ ! -f "$WRAPPER_JAR" ]; then
    echo "Downloading verified Gradle wrapper bootstrap..." >&2
    (cd "$APP_HOME" && "$JAVA_COMMAND" "$DOWNLOADER")
fi

exec "$JAVA_COMMAND" -Dorg.gradle.appname=gradlew -jar "$WRAPPER_JAR" "$@"
