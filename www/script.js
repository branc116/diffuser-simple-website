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
  const pointerData = { isDown: false, x: 0, y: 0, ids: new Set([]) };
  canvas.addEventListener('pointerdown', (e) => {
    pointerData.isDown = true;
    pointerData.ids.add(e.pointerId);
    pointerData.x = e.clientX;
    pointerData.y = e.clientY;
    console.log(pointerData);
  });
  canvas.addEventListener('pointerup', (e) => {
    pointerData.isDown = false;
    pointerData.ids.delete(e.pointerId);
  });

  canvas.addEventListener('pointercancel', (e) => {
    pointerData.isDown = false;
    pointerData.ids.delete(e.pointerId);
  });
  canvas.addEventListener('pointerout', (e) => {
    pointerData.isDown = false;
    pointerData.ids.delete(e.pointerId);
  });

  canvas.addEventListener('pointermove', (e) => {
    if (!pointerData.isDown) return;
    log(JSON.stringify({ x: e.clientX, y: e.clientY, ids: Array.from(pointerData.ids) }, null, 2));
    const fingerCount = Array.from(pointerData.ids).length;
    const deltaX = e.clientX - pointerData.x;
    const deltaY = e.clientY - pointerData.y;
    if (fingerCount >= 1) {
      zoomAndOffset.offset.x += deltaX * 2 * zoomAndOffset.zoom;
      zoomAndOffset.offset.y += deltaY * 2 * zoomAndOffset.zoom;
      pointerData.x = e.clientX;
      pointerData.y = e.clientY;
    }
    if (fingerCount === 2) {
    }
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

// startAppBtn.addEventListener('click', startApp);
generateBtn.addEventListener('click', () => {
  const stat = document.getElementById('statusLabel');
  stat.style.display = 'block';
  startImageGeneration(
    canvas,
    parseInt(numberOfIterationsElem.value),
    sendRefElem.checked,
    animateElem.checked,
    descriptionElem.value,
    () => {
      stat.style.display = 'none';
      zoomAndOffset.angle = 0;
      zoomAndOffset.offset.x = 0;
      zoomAndOffset.offset.y = 0;
      zoomAndOffset.zoom = 1;
    }
  );
});

setUpCanvasListeners();
startApp();
