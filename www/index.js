"use strict";

window.onload = async () => {
  const cavas = document.getElementsByTagName("canvas")[0];
  const body = document.getElementsByTagName("body")[0];
  const logArea = document.getElementById("logarea");

  const gl = cavas.getContext("webgl2", { preserveDrawingBuffer: true });
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
  const createProgram = async (verShader, fragShader, uniforms, attributes) => {
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
    const res = { "program": program };
    uniforms.forEach((uniform) => {
      res[uniform] = gl.getUniformLocation(program, uniform);
    });
    attributes.forEach((attribute) => {
      res[attribute] = gl.getAttribLocation(program, attribute);
    });
    return res;
  }
  const loadTexture = (url) => {
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
  

    
    // Because images have to be downloaded over the internet
    // they might take a moment until they are ready.
    // Until then put a single pixel in the texture so we can
    // use it immediately. When the image has finished downloading
    // we'll update the texture with the contents of the image.
    const level = 0;
    const internalFormat = gl.RGBA;
    const width = 1;
    const height = 1;
    const border = 0;
    const srcFormat = gl.RGBA;
    const srcType = gl.UNSIGNED_BYTE;
    const pixel = new Uint8Array([0, 0, 255, 255]);  // opaque blue
    gl.texImage2D(gl.TEXTURE_2D, level, internalFormat,
      width, height, border, srcFormat, srcType,
      pixel);
  
    const image = new Image();
    image.onload = () => {
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texImage2D(gl.TEXTURE_2D, level, internalFormat,
        srcFormat, srcType, image);
  
      // WebGL1 has different requirements for power of 2 images
      // vs non power of 2 images so check if the image is a
      // power of 2 in both dimensions.
      if (isPowerOf2(image.width) && isPowerOf2(image.height)) {
        // Yes, it's a power of 2. Generate mips.
        gl.generateMipmap(gl.TEXTURE_2D);
      } else {
        // No, it's not a power of 2. Turn off mips and set
        // wrapping to clamp to edge
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      }
    };
    image.src = url;
    window["image_loaded"] = (il) => {
      image.src = il.src;
    }
    return texture;
  }
  const getTransformationMatrix = () => {
    const initMatrix = {"mat": [[1, 0, 0], [0, 1, 0], [0, 0, 1]] };
    let oldx = 0, oldy = 0, moved = false;
    window.addEventListener("pointerdown", (e) => {
      if (e.target === cavas) {
        moved = true; oldx = e.clientX; oldy = e.clientY;
      }
    });
    window.addEventListener("pointerup", (e) => {
      moved = false;
    });

    window.addEventListener("pointermove", (e) => {
      if (moved) {
        const dx = e.clientX - oldx;
        const dy = e.clientY - oldy;
        oldx = e.clientX; oldy = e.clientY;
        const matrix = [[1, 0, dx], [0, 1, dy], [0, 0, 1]];
      }
    });
    return initMatrix;
  }
  const log = (msg) => {
    logArea.innerHTML = msg; 
  }
  const getZoomAndOffset = () => {
    const ret = { "zoom": 1, "offset": [0, 0], "angle": 0 };
    let oldx = 0, oldy = 0, oldDistance = undefined, oldAngle = undefined, moved = false;

    window.addEventListener("mousedown", (w) => {
      if (w.target === cavas && !moved) {
        oldx = w.clientX; oldy = w.clientY; moved = true;
      }
    });
    window.addEventListener("mouseup", (w) => {
      moved = false;
    });




    window.addEventListener("mousemove", (w) => {
      if (moved) {
        ret.offset[0] += (w.clientX-oldx) * ret.zoom;
        ret.offset[1] += (w.clientY-oldy) * ret.zoom;
        oldx = w.clientX; oldy = w.clientY;
      }
    });
    window.addEventListener("wheel", (w) => {
      if (w.target === cavas || moved) {
        ret.zoom *= 1 - w.deltaY / 1000;
      }
    });
    window.addEventListener("touchstart", (w) => {
      if (w.target === cavas && !moved) {
        oldx = w.touches[0].clientX; oldy = w.touches[0].clientY; moved = true;
        body.style.touchAction = "none";
      }
      else if (w.target !== cavas) {
        body.style.touchAction = "auto";
      }
    });
    window.addEventListener("touchend", (w) => {
      moved = false;
      oldDistance = undefined;
      oldAngle = undefined;
    });
    window.addEventListener("touchmove", (w) => {
      if (moved) {
        if (w.touches.length === 1) {
          ret.offset[0] += (w.touches[0].clientX-oldx) * ret.zoom;
          ret.offset[1] += (w.touches[0].clientY-oldy) * ret.zoom;
          oldx = w.touches[0].clientX; oldy = w.touches[0].clientY;
          oldDistance = oldAngle = undefined;
        }
        else if (w.touches.length === 2) {
          const dx = w.touches[0].clientX - w.touches[1].clientX;
          const dy = w.touches[0].clientY - w.touches[1].clientY;
          const d = Math.sqrt(dx * dx + dy * dy);
          log("d: " + (d - oldDistance));
          if (oldDistance === undefined) {
            oldDistance = d;
            oldAngle = Math.atan2(dy, dx);
          }
          else {
            ret.zoom *= 1 - ((d - oldDistance) / 1000);
            ret.angle += (oldAngle - Math.atan2(dy, dx)) / 100;
            oldDistance = d;
          }
        }
        w.preventDefault();
        return true;
      }
    }, false);
    return ret;
  }
  function isPowerOf2(value) {
    return value & (value - 1) === 0;
  }
  gl.viewport(0, 0, 512, 512);
  const rectBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, rectBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
    -1.0, -1.0,
    -1.0, 1.0,
    1.0, 1.0,

    -1.0, -1.0,
    1.0, -1.0,
    1.0, 1.0
  ]), gl.STATIC_DRAW);
  const rectIndexBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, rectIndexBuffer);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array([0, 1, 2, 0, 2, 3]), gl.STATIC_DRAW);
  const zoomAndOffset = getZoomAndOffset();
  const noise_program = await createProgram("noise_vert.glsl", "noise_frag.glsl", ["time", "resolution", "mmod", "offset", "zoom", "angle", "tex1"], ["position"]);
  const noise_program2 = await createProgram("noise_vert.glsl", "noise_frag.glsl", ["time", "resolution", "mmod", "offset", "zoom", "angle"], ["position"]);
  const programs = [noise_program, noise_program2];
  const texture1 = loadTexture("imgs/astronaut_rides_horse.png");

  const draw = () => {

    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.DST_ALPHA);
    for (let i = 0; i < programs.length; i++) {
      const program = programs[i];
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.useProgram(program.program);
      gl.enableVertexAttribArray(program.position);
      gl.bindBuffer(gl.ARRAY_BUFFER, rectBuffer);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, rectIndexBuffer);

      gl.vertexAttribPointer(program.position, 2, gl.FLOAT, false, 0, 0);
      gl.uniform1f(program.time, performance.now() / 1000 + 2);
      gl.uniform2f(program.resolution, gl.canvas.width, gl.canvas.height);
      gl.uniform1i(program.mmod, i);
      gl.uniform2f(program.offset, zoomAndOffset.offset[0], zoomAndOffset.offset[1]);
      gl.uniform1f(program.zoom, zoomAndOffset.zoom);
      gl.uniform1f(program.angle, zoomAndOffset.angle);

      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, texture1);
      gl.uniform1i(program.tex1, 0);

      gl.drawArrays(gl.TRIANGLES, 0, 6);
    }
    window.requestAnimationFrame(draw);
  }
  window.requestAnimationFrame(draw);
  
}
