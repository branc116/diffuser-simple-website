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

const api = new Api();

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
    // prettier-ignore
    new Float32Array([
      -1.0, -1.0,
      -1.0,  1.0,
       1.0,  1.0,
      -1.0, -1.0,
       1.0, -1.0,
       1.0,  1.0,
    ]),
    glContext.STATIC_DRAW
  );
  const rectIndexBuffer = glContext.createBuffer();
  glContext.bindBuffer(glContext.ELEMENT_ARRAY_BUFFER, rectIndexBuffer);
  glContext.bufferData(glContext.ELEMENT_ARRAY_BUFFER, new Uint16Array([0, 1, 2, 0, 2, 3]), glContext.STATIC_DRAW);
  //   const zoomAndOffset = getZoomAndOffset();
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
  const texture1 = loadTexture('api/image/1', glContext);

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
  const hammertime = new Hammer(canvas);
  hammertime.get('pinch').set({ enable: true });
  hammertime.get('rotate').set({ enable: true });
  hammertime.get('pan').set({ direction: Hammer.DIRECTION_ALL });
  let prevZoomAndOffset = structuredClone(zoomAndOffset);
  let touchDownRotation = 0;

  hammertime.on('pinch', (e) => {
    if (e.deltaTime < 30) touchDownRotation = e.rotation;
    zoomAndOffset.zoom = 1 / e.scale + prevZoomAndOffset.zoom - 1;
    zoomAndOffset.offset.x = e.deltaX * 2 * zoomAndOffset.zoom + prevZoomAndOffset.offset.x;
    zoomAndOffset.offset.y = e.deltaY * 2 * zoomAndOffset.zoom + prevZoomAndOffset.offset.y;
    zoomAndOffset.angle = ((e.rotation - touchDownRotation) * Math.PI) / 180.0 + prevZoomAndOffset.angle;
    if (e.isFinal) prevZoomAndOffset = structuredClone(zoomAndOffset);
  });

  hammertime.on('pan', (e) => {
    zoomAndOffset.offset.x = e.deltaX * 2 * zoomAndOffset.zoom + prevZoomAndOffset.offset.x;
    zoomAndOffset.offset.y = e.deltaY * 2 * zoomAndOffset.zoom + prevZoomAndOffset.offset.y;
    if (e.isFinal) prevZoomAndOffset = structuredClone(zoomAndOffset);
  }); // ma dobro je to!

  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    if (e.deltaY > 0) zoomAndOffset.zoom *= 1.1;
    else zoomAndOffset.zoom /= 1.1;
  });

  document.addEventListener('keydown', (e) => {
    switch (e.key) {
      case 'ArrowUp':
      case 'ArrowDown':
        zoomAndOffset.offset.y -= (e.ctrlKey ? 100 : 10) * zoomAndOffset.zoom * (e.key === 'ArrowUp' ? 1 : -1);
        break;
      case 'ArrowLeft':
      case 'ArrowRight':
        zoomAndOffset.offset.x -= (e.ctrlKey ? 100 : 10) * zoomAndOffset.zoom * (e.key === 'ArrowLeft' ? 1 : -1);
        break;
      case '4':
        zoomAndOffset.angle += 0.1;
        break;
      case '6':
        zoomAndOffset.angle -= 0.1;
        break;
      case '+':
        zoomAndOffset.zoom /= 1.1;
        break;
      case '-':
        zoomAndOffset.zoom *= 1.1;
        break;
    }
  });
};

generateBtn.addEventListener('click', (e) => {
  generateBtn.disabled = true;
  generateBtn.style.opacity = 0.8;
  generateBtn.innerHTML = `${loadingSvg} Generating image...`;
  startImageGeneration(
    canvas,
    parseInt(numberOfIterationsElem.value),
    sendRefElem.checked,
    animateElem.checked,
    descriptionElem.value,
    () => {
      generateBtn.disabled = false;
      generateBtn.style.opacity = 1;
      generateBtn.innerHTML = 'Generate image';
      zoomAndOffset.angle = 0;
      zoomAndOffset.offset.x = 0;
      zoomAndOffset.offset.y = 0;
      zoomAndOffset.zoom = 1;
    },
    (count) => (generateBtn.innerHTML = `${loadingSvg} Generating image... ${count}`)
  );
});

document.addEventListener('click', (e) => {
  if (e.target.classList.contains('generated-image')) {
    const cb = window['image_loaded'];
    if (cb) cb(e.target);
  }
});
api.register("cunt");

setUpCanvasListeners();
startApp();
const loadingSvg =
  '<svg width="32px" height="32px" viewBox="0 0 100 100" class="animate-spin" ><circle cx="50" cy="50" r="32" stroke-width="8" stroke="#ffffff" stroke-dasharray="50.26548245743669 50.26548245743669" fill="none" stroke-linecap="round"></circle></svg>';
