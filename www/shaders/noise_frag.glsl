precision highp float;

uniform float time;
uniform vec2 resolution;

vec3 generate_noise(vec2 v) {
    vec3 p = vec3(v, time) * time;
    vec3 f = fract(p);
    p = floor(p);
    vec3 g = vec3(dot(p,vec3(1.0,57.0,21.0)),
                  dot(p,vec3(71.0,43.0,13.0)),
                  dot(p,vec3(151.0,53.0,7.0)));
    return mod(g / 3.141565, 2.78887) / 2.78887;
}

void main(void)
{
    vec2 p = (2.0*gl_FragCoord.xy-resolution.xy)/resolution.y;
    gl_FragColor = vec4(generate_noise(p), 1.0);
}
