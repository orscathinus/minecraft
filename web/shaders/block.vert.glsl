#version 300 es
precision highp float;

layout(location = 0) in vec3 aPosition;
layout(location = 1) in vec2 aTexCoord;
layout(location = 2) in float aLightState;

uniform mat4 uProjection;
uniform mat4 uView;

out vec2 vTexCoord;
out float vLightState;
out float vViewDistance;

void main() {
    vec4 viewPosition = uView * vec4(aPosition, 1.0);
    gl_Position = uProjection * viewPosition;
    vTexCoord = aTexCoord;
    vLightState = step(0.5, aLightState);
    vViewDistance = length(viewPosition.xyz);
}
