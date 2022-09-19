enableHotReload();

/** @type HTMLCanvasElement */
const canvas = document.getElementById('canvas');
/** @type HTMLInputElement */
const descriptionElem = document.getElementById('description');
/** @type HTMLInputElement */
const sendRefElem = document.getElementById('sendRef');
/** @type HTMLInputElement */
const animateElem = document.getElementById('animate');
/** @type HTMLInputElement */
const numberOfIterationsElem = document.getElementById('iterations');
/** @type HTMLTextAreaElement */
const logArea = document.getElementById('logarea');
/** @type HTMLButtonElement */
const generateBtn = document.getElementById('generate');
/** @type HTMLButtonElement */
const startAppBtn = document.getElementById('startApp');

const glContext = canvas.getContext('webgl2', { preserveDrawingBuffer: true });

const zoomAndOffset = { zoom: 1, offset: { x: 0, y: 0 }, angle: 0 };

const startApp = async () => {
  if (!glContext) {
    alert('WebGL 2 is not available');
    return;
  }
  glContext.viewport(0, 0, 512, 512);
  const rectBuffer = glContext.createBuffer();
  glContext.bindBuffer(glContext.ARRAY_BUFFER, rectBuffer);
  glContext.bufferData(
    glContext.ARRAY_BUFFER,
    new Float32Array([
      -1.0, -1.0, -1.0, 1.0, 1.0, 1.0,

      -1.0, -1.0, 1.0, -1.0, 1.0, 1.0,
    ]),
    glContext.STATIC_DRAW
  );
  const rectIndexBuffer = glContext.createBuffer();
  glContext.bindBuffer(glContext.ELEMENT_ARRAY_BUFFER, rectIndexBuffer);
  glContext.bufferData(glContext.ELEMENT_ARRAY_BUFFER, new Uint16Array([0, 1, 2, 0, 2, 3]), glContext.STATIC_DRAW);
  //   const zoomAndOffset = getZoomAndOffset();
  console.log(glContext);
  const programs = await Promise.all([
    createProgram(
      'noise_vert.glsl',
      'noise_frag.glsl',
      ['time', 'resolution', 'mmod', 'offset', 'zoom', 'angle', 'tex1'],
      ['position'],
      glContext
    ),
    createProgram(
      'noise_vert.glsl',
      'noise_frag.glsl',
      ['time', 'resolution', 'mmod', 'offset', 'zoom', 'angle'],
      ['position'],
      glContext
    ),
  ]);
  const texture1 = loadTexture('imgs/astronaut_rides_horse.png', glContext);

  const draw = () => {
    glContext.clearColor(0.0, 0.0, 0.0, 1.0);
    glContext.clear(glContext.COLOR_BUFFER_BIT);
    glContext.enable(glContext.BLEND);
    glContext.blendFunc(glContext.SRC_ALPHA, glContext.DST_ALPHA);
    for (let i = 0; i < programs.length; i++) {
      const program = programs[i];
      glContext.bindFramebuffer(glContext.FRAMEBUFFER, null);
      glContext.useProgram(program.program);
      glContext.enableVertexAttribArray(program.position);
      glContext.bindBuffer(glContext.ARRAY_BUFFER, rectBuffer);
      glContext.bindBuffer(glContext.ELEMENT_ARRAY_BUFFER, rectIndexBuffer);

      glContext.vertexAttribPointer(program.position, 2, glContext.FLOAT, false, 0, 0);
      glContext.uniform1f(program.time, performance.now() / 1000 + 2);
      glContext.uniform2f(program.resolution, glContext.canvas.width, glContext.canvas.height);
      glContext.uniform1i(program.mmod, i);
      glContext.uniform2f(program.offset, zoomAndOffset.offset.x, zoomAndOffset.offset.y);
      glContext.uniform1f(program.zoom, zoomAndOffset.zoom);
      glContext.uniform1f(program.angle, zoomAndOffset.angle);

      glContext.activeTexture(glContext.TEXTURE0);
      glContext.bindTexture(glContext.TEXTURE_2D, texture1);
      glContext.uniform1i(program.tex1, 0);

      glContext.drawArrays(glContext.TRIANGLES, 0, 6);
    }
    window.requestAnimationFrame(draw);
  };
  window.requestAnimationFrame(draw);
};

const setUpCanvasListeners = () => {
  canvas.addEventListener('wheel', (e) => {});
};

// startAppBtn.addEventListener('click', startApp);
generateBtn.addEventListener('click', () =>
  startImageGeneration(
    canvas,
    parseInt(numberOfIterationsElem.value),
    sendRefElem.checked,
    animateElem.checked,
    descriptionElem.value
  )
);

startApp();
