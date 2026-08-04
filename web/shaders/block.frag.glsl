#version 300 es
precision highp float;

uniform sampler2D uAtlas;
in vec2 vTexCoord;
in float vBrightness;
out vec4 outColor;

void main() {
    vec4 texel = texture(uAtlas, vTexCoord);
    outColor = vec4(texel.rgb * vBrightness, texel.a);
}
