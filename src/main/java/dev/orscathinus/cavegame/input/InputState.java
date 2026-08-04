package dev.orscathinus.cavegame.input;

import static org.lwjgl.glfw.GLFW.GLFW_KEY_LAST;
import static org.lwjgl.glfw.GLFW.GLFW_RELEASE;
import static org.lwjgl.glfw.GLFW.glfwSetKeyCallback;
import static org.lwjgl.system.MemoryUtil.NULL;

import java.util.Arrays;
import org.lwjgl.glfw.GLFWKeyCallback;

/** Tracks the current pressed/released state of GLFW keyboard keys. */
public final class InputState implements AutoCloseable {
    private final boolean[] keys = new boolean[GLFW_KEY_LAST + 1];

    private long windowHandle = NULL;
    private GLFWKeyCallback keyCallback;

    public void attach(long windowHandle) {
        if (windowHandle == NULL) {
            throw new IllegalArgumentException("windowHandle must not be NULL");
        }
        if (this.windowHandle != NULL) {
            throw new IllegalStateException("InputState is already attached to a window");
        }

        this.windowHandle = windowHandle;
        keyCallback = GLFWKeyCallback.create((window, key, scanCode, action, modifiers) -> {
            if (key >= 0 && key < keys.length) {
                keys[key] = action != GLFW_RELEASE;
            }
        });

        GLFWKeyCallback previous = glfwSetKeyCallback(windowHandle, keyCallback);
        if (previous != null) {
            previous.free();
        }
    }

    public boolean isKeyDown(int key) {
        return key >= 0 && key < keys.length && keys[key];
    }

    @Override
    public void close() {
        if (windowHandle != NULL) {
            GLFWKeyCallback installed = glfwSetKeyCallback(windowHandle, null);
            if (installed != null) {
                installed.free();
            }
        } else if (keyCallback != null) {
            keyCallback.free();
        }

        keyCallback = null;
        windowHandle = NULL;
        Arrays.fill(keys, false);
    }
}
