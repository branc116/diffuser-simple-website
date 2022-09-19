const enableHotReload = () => {
  const date = new Date().getTime();
  const checkReload = async () => {
    const lastModified = await fetch('last-modified').then((resp) => resp.json());
    if (lastModified > date) location.reload();
  };
  setInterval(checkReload, 1512);
};

const numberToUint8Array = (number) => {
  const array = new Uint8Array(4);
  array[0] = (number >> 0) & 0xff;
  array[1] = (number >> 8) & 0xff;
  array[2] = (number >> 16) & 0xff;
  array[3] = (number >> 24) & 0xff;
  return array;
};

const isPowerOf2 = (value) => value & (value - 1 === 0);

const log = (msg) => {
  logArea.innerHTML = msg;
};

const appendBlobImage = (blob) => {
  const img = new Image();
  img.src = URL.createObjectURL(blob);
  document.body.appendChild(img);
  const cb = window['image_loaded'];
  if (cb) cb(img);
};

const generateImage = async (numberOfIterations, blob, sendRef, description) => {
  if (numberOfIterations == 3) numberOfIterations++;

  const blobToSend = sendRef
    ? new Blob([
        numberToUint8Array(69),
        numberToUint8Array(420),
        numberToUint8Array(numberOfIterations),
        numberToUint8Array(blob.size),
        blob,
        description,
      ])
    : new Blob([
        numberToUint8Array(69),
        numberToUint8Array(420),
        numberToUint8Array(numberOfIterations),
        numberToUint8Array(0xffffffff),
        description,
      ]);

  const blobResponse = await fetch('.', {
    method: 'POST',
    body: blobToSend,
    headers: {
      'Content-Type': 'application/octet-stream',
    },
  }).then((resp) => resp.blob());

  appendBlobImage(blobResponse.slice(4, blobResponse.size, 'image/png'));
};

const startImageGeneration = async (canvas, numberOfIterations, sendRef, animate, description) => {
  if (sendRef) {
    canvas.toBlob(
      async (blob) => {
        if (animate) {
          for (let i = 0; i < numberOfIterations; i++) {
            try {
              await generateImage(i, blob, sendRef, description);
            } catch (e) {
              console.log(e);
            }
          }
        } else await generateImage(numberOfIterations, blob, sendRef, description);
      },
      'image/jpeg',
      0.8
    );
  } else await generateImage(numberOfIterations, blob, sendRef, description);
};

const createShader = (type, source, canvasWebGlContext) => {
  const shader = canvasWebGlContext?.createShader(type);
  if (!shader) {
    alert('unable to create shader');
    return null;
  }
  canvasWebGlContext.shaderSource(shader, source);
  canvasWebGlContext.compileShader(shader);
  if (!canvasWebGlContext.getShaderParameter(shader, canvasWebGlContext.COMPILE_STATUS)) {
    alert('An error occurred compiling the shaders: ' + canvasWebGlContext.getShaderInfoLog(shader));
    canvasWebGlContext.deleteShader(shader);
    return null;
  }
  return shader;
};

const createProgram = async (verShader, fragShader, uniforms, attributes, canvasWebGlContext) => {
  const program = canvasWebGlContext.createProgram();
  if (!program) {
    alert('Unable to create program');
    return null;
  }
  const vertReq = await fetch('shaders/' + verShader);
  const vertSource = await vertReq.text();

  const fragReq = await fetch('shaders/' + fragShader);
  const fragSource = await fragReq.text();

  canvasWebGlContext.attachShader(program, createShader(canvasWebGlContext.VERTEX_SHADER, vertSource, canvasWebGlContext));
  canvasWebGlContext.attachShader(program, createShader(canvasWebGlContext.FRAGMENT_SHADER, fragSource, canvasWebGlContext));
  canvasWebGlContext.linkProgram(program);
  if (!canvasWebGlContext.getProgramParameter(program, canvasWebGlContext.LINK_STATUS)) {
    alert('Unable to initialize the shader program: ' + canvasWebGlContext.getProgramInfoLog(program));
    return null;
  }
  const res = { program: program };
  uniforms.forEach((uniform) => {
    res[uniform] = canvasWebGlContext.getUniformLocation(program, uniform);
  });
  attributes.forEach((attribute) => {
    res[attribute] = canvasWebGlContext.getAttribLocation(program, attribute);
  });
  return res;
};

const loadTexture = (url, canvasWebGlContext) => {
  const texture = canvasWebGlContext.createTexture();
  canvasWebGlContext.bindTexture(canvasWebGlContext.TEXTURE_2D, texture);

  // Because images have to be downloaded over the internet
  // they might take a moment until they are ready.
  // Until then put a single pixel in the texture so we can
  // use it immediately. When the image has finished downloading
  // we'll update the texture with the contents of the image.
  const level = 0;
  const internalFormat = canvasWebGlContext.RGBA;
  const width = 1;
  const height = 1;
  const border = 0;
  const srcFormat = canvasWebGlContext.RGBA;
  const srcType = canvasWebGlContext.UNSIGNED_BYTE;
  const pixel = new Uint8Array([0, 0, 255, 255]); // opaque blue
  canvasWebGlContext.texImage2D(
    canvasWebGlContext.TEXTURE_2D,
    level,
    internalFormat,
    width,
    height,
    border,
    srcFormat,
    srcType,
    pixel
  );

  const image = new Image();
  image.onload = () => {
    canvasWebGlContext.bindTexture(canvasWebGlContext.TEXTURE_2D, texture);
    canvasWebGlContext.texImage2D(canvasWebGlContext.TEXTURE_2D, level, internalFormat, srcFormat, srcType, image);

    // WebGL1 has different requirements for power of 2 images
    // vs non power of 2 images so check if the image is a
    // power of 2 in both dimensions.
    if (isPowerOf2(image.width) && isPowerOf2(image.height)) {
      // Yes, it's a power of 2. Generate mips.
      canvasWebGlContext.generateMipmap(canvasWebGlContext.TEXTURE_2D);
    } else {
      // No, it's not a power of 2. Turn off mips and set
      // wrapping to clamp to edge
      canvasWebGlContext.texParameteri(
        canvasWebGlContext.TEXTURE_2D,
        canvasWebGlContext.TEXTURE_WRAP_S,
        canvasWebGlContext.CLAMP_TO_EDGE
      );
      canvasWebGlContext.texParameteri(
        canvasWebGlContext.TEXTURE_2D,
        canvasWebGlContext.TEXTURE_WRAP_T,
        canvasWebGlContext.CLAMP_TO_EDGE
      );
      canvasWebGlContext.texParameteri(
        canvasWebGlContext.TEXTURE_2D,
        canvasWebGlContext.TEXTURE_MIN_FILTER,
        canvasWebGlContext.LINEAR
      );
    }
  };
  image.src = url;
  window['image_loaded'] = (appendedImage) => {
    image.src = appendedImage.src;
  };
  return texture;
};
