@echo off
setlocal
set APP_HOME=%~dp0
set WRAPPER_JAR=%APP_HOME%gradle\wrapper\gradle-wrapper.jar
set DOWNLOADER=%APP_HOME%gradle\wrapper\WrapperDownloader.java

if defined JAVA_HOME (
    set JAVA_COMMAND=%JAVA_HOME%\bin\java.exe
) else (
    set JAVA_COMMAND=java.exe
)

if not exist "%WRAPPER_JAR%" (
    echo Downloading verified Gradle wrapper bootstrap... 1>&2
    pushd "%APP_HOME%"
    "%JAVA_COMMAND%" "%DOWNLOADER%"
    if errorlevel 1 (
        popd
        exit /b 1
    )
    popd
)

"%JAVA_COMMAND%" -Dorg.gradle.appname=gradlew -jar "%WRAPPER_JAR%" %*
exit /b %ERRORLEVEL%
