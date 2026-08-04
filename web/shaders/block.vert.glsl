#version 300 es
precision highp float;

layout(location = 0) in vec3 aPosition;
layout(location = 1) in vec2 aTexCoord;
layout(location = 2) in float aBrightness;

uniform mat4 uProjection;
uniform mat4 uView;

out vec2 vTexCoord;
out float vBrightness;

void main() {
    gl_Position = uProjection * uView * vec4(aPosition, 1.0);
    vTexCoord = aTexCoord;
    vBrightness = aBrightness;
}
