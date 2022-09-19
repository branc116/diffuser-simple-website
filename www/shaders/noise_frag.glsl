precision highp float;

uniform float time;
uniform int mmod;
uniform vec2 resolution;
uniform vec2 offset;
uniform float zoom;
uniform float angle;

uniform sampler2D tex1;

vec3 generate_noise(vec2 v) {
    vec3 p = vec3(v, time) * time;
    vec3 f = fract(p);
    p = floor(p);
    vec3 g = vec3(dot(p,vec3(1.0,57.0,21.0)),
                  dot(p,vec3(71.0,43.0,13.0)),
                  dot(p,vec3(151.0,53.0,7.0)));
    return mod(g / 3.141565, 2.78887) / 2.78887;
}

vec2 create_matrix(vec3 i) {
    mat3 offset = mat3(1,               0, 0,
                       0,               1, 0,
                       -offset.x/resolution.x, offset.y/resolution.y, 1);
    mat3 rotate = mat3(cos(angle), sin(angle), 0,
                       -sin(angle), cos(angle), 0,
                       0,               0, 1);
    mat3 scale = mat3(zoom, 0, 0,
                      0, zoom, 0,
                      0, 0, 1);
    return (rotate * offset * scale * vec3(i.xy, 1)).xy;
}

void main(void)
{
    vec2 f = gl_FragCoord.xy;
    vec2 p = (2.0*f.xy-resolution.xy)/resolution.y;
    p = create_matrix(vec3(p, 1));
    if (length(p) > 0.5) {
        gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
        return;
    }
    if (mmod == 1) {
        //gl_FragColor = 0.5 * vec4(generate_noise(p), 1.0);
    }else {
        gl_FragColor = texture2D(tex1, p*vec2(1.0, -1.0) + 0.5);
        //p = vec2(pow(abs(p.x), 0.1), pow(abs(p.y), 0.1));
        //gl_FragColor = 0.5 * vec4(generate_noise(p), 1.0);
    }
    gl_FragColor.a = 1.0;
}
