"use strict";

window.onload = async () => {
const cavas = document.getElementsByTagName("canvas")[0];
const gl = cavas.getContext("webgl2", {preserveDrawingBuffer: true});
if (!gl) {
  alert("WebGL 2 is not available");
  return;
}
const createShader = (type, source) => {
    const shader = gl.createShader(type);
    if (!shader) {
        alert("unable to create shader");
        return null;
    }
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        alert("An error occurred compiling the shaders: " + gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
    }
    return shader;
}
const createProgram = async (verShader, fragShader) => {
    const program = gl.createProgram();
    if (!program) {
        alert("Unable to create program");
        return null;
    }
    const vertReq = await fetch("shaders/" + verShader)
    const vertSource = await vertReq.text();

    const fragReq = await fetch("shaders/" + fragShader)
    const fragSource = await fragReq.text();

    gl.attachShader(program, createShader(gl.VERTEX_SHADER, vertSource));
    gl.attachShader(program, createShader(gl.FRAGMENT_SHADER, fragSource));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        alert("Unable to initialize the shader program: " + gl.getProgramInfoLog(program));
        return null;
    }
    return program;
}
const noise_program = await createProgram("noise_vert.glsl", "noise_frag.glsl");
gl.viewport(0, 0, 512, 512);
const rectBuffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, rectBuffer);
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
    -1.0, -1.0,
    -1.0,  1.0,
     1.0,  1.0,

    -1.0, -1.0,
     1.0, -1.0,
     1.0,  1.0
]), gl.STATIC_DRAW);
const rectIndexBuffer = gl.createBuffer();
gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, rectIndexBuffer);
gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array([0, 1, 2, 0, 2, 3]), gl.STATIC_DRAW);

const attributeLocation = gl.getAttribLocation(noise_program, "position");

const uniform_time = gl.getUniformLocation(noise_program, "time");
const uniform_location = gl.getUniformLocation(noise_program, "resolution");


const draw = () => {
    
    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.useProgram(noise_program);
    gl.enableVertexAttribArray(attributeLocation);
    gl.bindBuffer(gl.ARRAY_BUFFER, rectBuffer);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, rectIndexBuffer);

    gl.vertexAttribPointer(attributeLocation, 2, gl.FLOAT, false, 0, 0);
    gl.uniform1f(uniform_time, performance.now() / 1000);
    gl.uniform2f(uniform_location, gl.canvas.width, gl.canvas.height);
    
    
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    window.requestAnimationFrame(draw);
}
window.requestAnimationFrame(draw);
}