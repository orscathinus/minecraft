package dev.orscathinus.cavegame.render;

import static org.lwjgl.glfw.GLFW.GLFW_CONTEXT_VERSION_MAJOR;
import static org.lwjgl.glfw.GLFW.GLFW_CONTEXT_VERSION_MINOR;
import static org.lwjgl.glfw.GLFW.GLFW_FALSE;
import static org.lwjgl.glfw.GLFW.GLFW_OPENGL_CORE_PROFILE;
import static org.lwjgl.glfw.GLFW.GLFW_OPENGL_FORWARD_COMPAT;
import static org.lwjgl.glfw.GLFW.GLFW_OPENGL_PROFILE;
import static org.lwjgl.glfw.GLFW.GLFW_RESIZABLE;
import static org.lwjgl.glfw.GLFW.GLFW_TRUE;
import static org.lwjgl.glfw.GLFW.GLFW_VISIBLE;
import static org.lwjgl.glfw.GLFW.glfwCreateWindow;
import static org.lwjgl.glfw.GLFW.glfwDefaultWindowHints;
import static org.lwjgl.glfw.GLFW.glfwDestroyWindow;
import static org.lwjgl.glfw.GLFW.glfwGetFramebufferSize;
import static org.lwjgl.glfw.GLFW.glfwGetPrimaryMonitor;
import static org.lwjgl.glfw.GLFW.glfwGetTime;
import static org.lwjgl.glfw.GLFW.glfwGetVideoMode;
import static org.lwjgl.glfw.GLFW.glfwInit;
import static org.lwjgl.glfw.GLFW.glfwMakeContextCurrent;
import static org.lwjgl.glfw.GLFW.glfwPollEvents;
import static org.lwjgl.glfw.GLFW.glfwSetErrorCallback;
import static org.lwjgl.glfw.GLFW.glfwSetFramebufferSizeCallback;
import static org.lwjgl.glfw.GLFW.glfwSetWindowPos;
import static org.lwjgl.glfw.GLFW.glfwSetWindowShouldClose;
import static org.lwjgl.glfw.GLFW.glfwShowWindow;
import static org.lwjgl.glfw.GLFW.glfwSwapBuffers;
import static org.lwjgl.glfw.GLFW.glfwSwapInterval;
import static org.lwjgl.glfw.GLFW.glfwTerminate;
import static org.lwjgl.glfw.GLFW.glfwWindowShouldClose;
import static org.lwjgl.glfw.GLFW.glfwWindowHint;
import static org.lwjgl.opengl.GL11.GL_COLOR_BUFFER_BIT;
import static org.lwjgl.opengl.GL11.GL_RENDERER;
import static org.lwjgl.opengl.GL11.GL_VERSION;
import static org.lwjgl.opengl.GL11.glClear;
import static org.lwjgl.opengl.GL11.glClearColor;
import static org.lwjgl.opengl.GL11.glGetString;
import static org.lwjgl.opengl.GL11.glViewport;
import static org.lwjgl.system.MemoryUtil.NULL;

import java.nio.IntBuffer;
import java.util.Objects;
import java.util.logging.Level;
import java.util.logging.Logger;
import org.lwjgl.glfw.Callbacks;
import org.lwjgl.glfw.GLFWErrorCallback;
import org.lwjgl.glfw.GLFWVidMode;
import org.lwjgl.opengl.GL;
import org.lwjgl.opengl.GLCapabilities;
import org.lwjgl.system.MemoryStack;

/** Owns GLFW initialization, the native window, and its OpenGL context. */
public final class Window implements AutoCloseable {
    private static final Logger LOGGER = Logger.getLogger(Window.class.getName());

    private static final float SKY_RED = 127.0f / 255.0f;
    private static final float SKY_GREEN = 204.0f / 255.0f;
    private static final float SKY_BLUE = 1.0f;

    private final String title;
    private final int initialWidth;
    private final int initialHeight;
    private final boolean vsync;
    private final boolean hidden;

    private GLFWErrorCallback errorCallback;
    private long handle = NULL;
    private boolean glfwInitialized;
    private boolean open;

    public Window(String title, int initialWidth, int initialHeight, boolean vsync, boolean hidden) {
        this.title = Objects.requireNonNull(title, "title");
        if (initialWidth <= 0 || initialHeight <= 0) {
            throw new IllegalArgumentException("Window dimensions must be positive");
        }
        this.initialWidth = initialWidth;
        this.initialHeight = initialHeight;
        this.vsync = vsync;
        this.hidden = hidden;
    }

    public void open() {
        if (open) {
            throw new IllegalStateException("Window is already open");
        }

        try {
            installErrorCallback();
            if (!glfwInit()) {
                throw new IllegalStateException("GLFW initialization failed");
            }
            glfwInitialized = true;

            glfwDefaultWindowHints();
            glfwWindowHint(GLFW_CONTEXT_VERSION_MAJOR, 3);
            glfwWindowHint(GLFW_CONTEXT_VERSION_MINOR, 3);
            glfwWindowHint(GLFW_OPENGL_PROFILE, GLFW_OPENGL_CORE_PROFILE);
            glfwWindowHint(GLFW_OPENGL_FORWARD_COMPAT, GLFW_TRUE);
            glfwWindowHint(GLFW_RESIZABLE, GLFW_TRUE);
            glfwWindowHint(GLFW_VISIBLE, GLFW_FALSE);

            handle = glfwCreateWindow(initialWidth, initialHeight, title, NULL, NULL);
            if (handle == NULL) {
                throw new IllegalStateException("GLFW could not create the game window");
            }

            centerOnPrimaryMonitor();
            glfwMakeContextCurrent(handle);

            GLCapabilities capabilities = GL.createCapabilities();
            if (!capabilities.OpenGL33) {
                throw new IllegalStateException("OpenGL 3.3 Core is required but unavailable");
            }

            glfwSwapInterval(vsync ? 1 : 0);
            glClearColor(SKY_RED, SKY_GREEN, SKY_BLUE, 1.0f);
            glfwSetFramebufferSizeCallback(handle, (window, width, height) ->
                    glViewport(0, 0, Math.max(width, 0), Math.max(height, 0))
            );
            updateViewportFromFramebuffer();

            logGraphicsInformation();
            if (!hidden) {
                glfwShowWindow(handle);
            }
            open = true;
        } catch (Throwable failure) {
            LOGGER.log(Level.SEVERE, "Window and OpenGL initialization failed.", failure);
            close();
            throw failure;
        }
    }

    public long handle() {
        ensureOpen();
        return handle;
    }

    public boolean shouldClose() {
        ensureOpen();
        return glfwWindowShouldClose(handle);
    }

    public void requestClose() {
        ensureOpen();
        glfwSetWindowShouldClose(handle, true);
    }

    public void pollEvents() {
        ensureOpen();
        glfwPollEvents();
    }

    public void clear() {
        ensureOpen();
        glClear(GL_COLOR_BUFFER_BIT);
    }

    public void swapBuffers() {
        ensureOpen();
        glfwSwapBuffers(handle);
    }

    public double timeSeconds() {
        if (!glfwInitialized) {
            throw new IllegalStateException("GLFW is not initialized");
        }
        return glfwGetTime();
    }

    @Override
    public void close() {
        open = false;

        if (handle != NULL) {
            GL.setCapabilities(null);
            Callbacks.glfwFreeCallbacks(handle);
            glfwDestroyWindow(handle);
            handle = NULL;
        }

        if (glfwInitialized) {
            glfwTerminate();
            glfwInitialized = false;
        }

        GLFWErrorCallback installedCallback = glfwSetErrorCallback(null);
        if (installedCallback != null) {
            installedCallback.free();
        }
        errorCallback = null;
    }

    private void installErrorCallback() {
        errorCallback = GLFWErrorCallback.create((error, descriptionPointer) -> {
            String description = GLFWErrorCallback.getDescription(descriptionPointer);
            LOGGER.severe("GLFW error 0x" + Integer.toHexString(error) + ": " + description);
        });
        GLFWErrorCallback previous = glfwSetErrorCallback(errorCallback);
        if (previous != null) {
            previous.free();
        }
    }

    private void updateViewportFromFramebuffer() {
        try (MemoryStack stack = MemoryStack.stackPush()) {
            IntBuffer width = stack.mallocInt(1);
            IntBuffer height = stack.mallocInt(1);
            glfwGetFramebufferSize(handle, width, height);
            glViewport(0, 0, Math.max(width.get(0), 0), Math.max(height.get(0), 0));
        }
    }

    private void centerOnPrimaryMonitor() {
        long monitor = glfwGetPrimaryMonitor();
        if (monitor == NULL) {
            return;
        }

        GLFWVidMode videoMode = glfwGetVideoMode(monitor);
        if (videoMode != null) {
            int x = Math.max((videoMode.width() - initialWidth) / 2, 0);
            int y = Math.max((videoMode.height() - initialHeight) / 2, 0);
            glfwSetWindowPos(handle, x, y);
        }
    }

    private void logGraphicsInformation() {
        String version = Objects.requireNonNullElse(glGetString(GL_VERSION), "unknown");
        String renderer = Objects.requireNonNullElse(glGetString(GL_RENDERER), "unknown");
        LOGGER.info(() -> "OpenGL version: " + version);
        LOGGER.info(() -> "OpenGL renderer: " + renderer);
        LOGGER.info(() -> "VSync: " + (vsync ? "enabled" : "disabled"));
    }

    private void ensureOpen() {
        if (!open || handle == NULL) {
            throw new IllegalStateException("Window is not open");
        }
    }
}
