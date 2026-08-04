export const PIXEL_TEXTURE_SAMPLING = Object.freeze({
    minFilter: "NEAREST",
    magFilter: "NEAREST",
    wrapS: "CLAMP_TO_EDGE",
    wrapT: "CLAMP_TO_EDGE",
    mipmaps: false,
});

export function configurePixelTextureSampling(gl) {
    if (!gl || typeof gl.texParameteri !== "function") {
        throw new TypeError("A WebGL-compatible context is required");
    }
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
}
