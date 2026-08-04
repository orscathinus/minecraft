#version 300 es
precision highp float;

uniform sampler2D uAtlas;
in vec2 vTexCoord;
in float vLightState;
in float vViewDistance;
out vec4 outColor;

const float DARK_BRIGHTNESS = 0.28;
const float DARK_FOG_START = 4.0;
const float DARK_FOG_END = 30.0;
const float DARK_FOG_STRENGTH = 0.96;
const float DARK_FOG_STEPS = 5.0;

void main() {
    vec4 texel = texture(uAtlas, vTexCoord);
    float lightState = step(0.5, vLightState);
    float brightness = mix(DARK_BRIGHTNESS, 1.0, lightState);
    vec3 litColor = texel.rgb * brightness;

    float fogRamp = clamp(
        (vViewDistance - DARK_FOG_START) / (DARK_FOG_END - DARK_FOG_START),
        0.0,
        1.0
    );
    float steppedFog = floor(fogRamp * DARK_FOG_STEPS) / DARK_FOG_STEPS;
    float darkFog = steppedFog * DARK_FOG_STRENGTH * (1.0 - lightState);
    outColor = vec4(mix(litColor, vec3(0.0), darkFog), texel.a);
}
