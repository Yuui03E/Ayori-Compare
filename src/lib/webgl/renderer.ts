import type { Frame, Point, ViewState } from '../types';
import { vertexShader, fragmentShader } from './shaders';
import { fitView, panelPoint, toUv, zoomAround } from './coordinates';

interface Norm16 {
  RGBA16_EXT: number;
}
export class Renderer {
  readonly gl: WebGL2RenderingContext;
  readonly norm16: Norm16 | null;
  readonly frames: (Frame | null)[] = Array(8).fill(null);
  readonly fallback: boolean[] = Array(8).fill(false);
  readonly textures: (WebGLTexture | null)[] = Array(8).fill(null);
  readonly view: ViewState = {
    zoom: 1,
    pan: { x: 0, y: 0 },
    mouse: { x: 0, y: 0 },
    mode: 0,
    subMode: 0,
    slotA: 0,
    slotB: 1,
    gain: 8,
    bandFrequency: 32,
    loupe: false,
    grid: false,
    filter: 'auto',
  };
  base = { width: 1, height: 1 };
  private program: WebGLProgram;
  private uniforms = new Map<string, WebGLUniformLocation>();
  private vao: WebGLVertexArrayObject;
  private blank: WebGLTexture;
  private observer: ResizeObserver;
  private pending = 0;
  private fitLocked = true;
  private disposed = false;
  onChange: () => void = () => {};
  onError: (message: string) => void = () => {};

  constructor(readonly canvas: HTMLCanvasElement) {
    const gl = canvas.getContext('webgl2', {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      premultipliedAlpha: false,
      preserveDrawingBuffer: false,
    });
    if (!gl)
      throw new Error(
        'WebGL2 is unavailable. Enable graphics acceleration or update your display driver.',
      );
    this.gl = gl;
    this.norm16 = gl.getExtension('EXT_texture_norm16') as Norm16 | null;
    this.program = this.createProgram();
    this.vao = gl.createVertexArray()!;
    this.blank = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, this.blank);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA8,
      1,
      1,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      new Uint8Array([0, 0, 0, 255]),
    );
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(canvas);
    window.addEventListener('resize', this.resize);
    canvas.addEventListener('webglcontextlost', this.contextLost);
    canvas.addEventListener('webglcontextrestored', this.contextRestored);
    this.resize();
  }
  private createProgram() {
    const gl = this.gl;
    const shaders = [
      [gl.VERTEX_SHADER, vertexShader],
      [gl.FRAGMENT_SHADER, fragmentShader],
    ].map(([type, code]) => {
      const shader = gl.createShader(type as number)!;
      gl.shaderSource(shader, code as string);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        const log = gl.getShaderInfoLog(shader);
        gl.deleteShader(shader);
        throw new Error(`Unable to compile comparison shader: ${log}`);
      }
      return shader;
    });
    const program = gl.createProgram()!;
    shaders.forEach((shader) => gl.attachShader(program, shader));
    gl.linkProgram(program);
    shaders.forEach((shader) => gl.deleteShader(shader));
    if (!gl.getProgramParameter(program, gl.LINK_STATUS))
      throw new Error(`Unable to link comparison shader: ${gl.getProgramInfoLog(program)}`);
    return program;
  }
  private location(name: string) {
    if (!this.uniforms.has(name))
      this.uniforms.set(name, this.gl.getUniformLocation(this.program, name)!);
    return this.uniforms.get(name)!;
  }
  private contextLost = (event: Event) => {
    event.preventDefault();
    this.onError('Graphics context interrupted. Waiting for recovery…');
  };
  private contextRestored = () => {
    try {
      this.program = this.createProgram();
      this.uniforms.clear();
      this.vao = this.gl.createVertexArray()!;
      this.blank = this.gl.createTexture()!;
      const gl = this.gl;
      gl.bindTexture(gl.TEXTURE_2D, this.blank);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA8,
        1,
        1,
        0,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        new Uint8Array([0, 0, 0, 255]),
      );
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      this.textures.fill(null);
      this.frames.forEach((frame, i) => {
        if (frame) this.upload(i, frame);
      });
      this.invalidate();
    } catch (error) {
      this.onError(String(error));
    }
  };
  resize = () => {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const width = Math.max(1, Math.round(rect.width * dpr)),
      height = Math.max(1, Math.round(rect.height * dpr));
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
      if (this.fitLocked) this.fit();
      else this.invalidate();
    }
  };
  point(event: { clientX: number; clientY: number }): Point {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) * this.canvas.width) / rect.width,
      y: ((event.clientY - rect.top) * this.canvas.height) / rect.height,
    };
  }
  uv(point = this.view.mouse) {
    return toUv(
      panelPoint(point, this.canvas.width, this.view.mode === 2),
      this.view.pan,
      this.view.zoom,
      this.base.width,
      this.base.height,
    );
  }
  upload(slot: number, frame: Frame) {
    const gl = this.gl;
    if (
      frame.width > gl.getParameter(gl.MAX_TEXTURE_SIZE) ||
      frame.height > gl.getParameter(gl.MAX_TEXTURE_SIZE)
    )
      throw new Error('Image exceeds this GPU’s texture-size limit.');
    const old = this.textures[slot];
    const texture = gl.createTexture();
    if (!texture) throw new Error('Unable to allocate an image texture.');
    gl.activeTexture(gl.TEXTURE0 + slot);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    const fallback = frame.depth === 16 && !this.norm16;
    const pixels = fallback
      ? Uint8Array.from(frame.pixels, (sample) => sample >>> 8)
      : frame.pixels;
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      frame.depth === 16 && this.norm16 ? this.norm16.RGBA16_EXT : gl.RGBA8,
      frame.width,
      frame.height,
      0,
      gl.RGBA,
      frame.depth === 16 && this.norm16 ? gl.UNSIGNED_SHORT : gl.UNSIGNED_BYTE,
      pixels,
    );
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.generateMipmap(gl.TEXTURE_2D);
    const error = gl.getError();
    if (error !== gl.NO_ERROR) {
      gl.deleteTexture(texture);
      throw new Error(`GPU upload failed (${error}). Image may exceed available graphics memory.`);
    }
    this.textures[slot] = texture;
    this.frames[slot] = frame;
    this.fallback[slot] = fallback;
    if (old) gl.deleteTexture(old);
    this.updateBase();
    this.invalidate();
  }
  remove(slot: number) {
    if (this.textures[slot]) this.gl.deleteTexture(this.textures[slot]);
    this.textures[slot] = null;
    this.frames[slot] = null;
    this.fallback[slot] = false;
    this.updateBase();
    this.invalidate();
  }
  clear() {
    for (let i = 0; i < 8; i++) this.remove(i);
  }
  private updateBase() {
    this.base = {
      width: Math.max(1, ...this.frames.map((f) => f?.width ?? 0)),
      height: Math.max(1, ...this.frames.map((f) => f?.height ?? 0)),
    };
  }
  fit() {
    const next = fitView(
      this.canvas.width,
      this.canvas.height,
      this.base.width,
      this.base.height,
      this.view.mode === 2,
      48 * (window.devicePixelRatio || 1),
    );
    this.view.zoom = next.zoom;
    this.view.pan = next.pan;
    this.fitLocked = true;
    this.invalidate();
  }
  zoomTo(zoom: number, cursor?: Point) {
    const center = cursor ?? {
      x: (this.view.mode === 2 ? this.canvas.width / 2 : this.canvas.width) / 2,
      y: this.canvas.height / 2,
    };
    const local = panelPoint(center, this.canvas.width, this.view.mode === 2);
    const next = Math.max(0.005, Math.min(128, zoom));
    this.view.pan = zoomAround(local, this.view.pan, this.view.zoom, next);
    this.view.zoom = next;
    this.fitLocked = false;
    this.invalidate();
  }
  panBy(delta: Point) {
    this.view.pan = { x: this.view.pan.x + delta.x, y: this.view.pan.y + delta.y };
    this.fitLocked = false;
    this.invalidate();
  }
  setMode(mode: ViewState['mode'], subMode: number) {
    const wasSplit = this.view.mode === 2;
    if (wasSplit !== (mode === 2)) {
      const oldWidth = this.canvas.width / (wasSplit ? 2 : 1),
        nextWidth = this.canvas.width / (mode === 2 ? 2 : 1);
      this.view.pan = { x: this.view.pan.x + (nextWidth - oldWidth) / 2, y: this.view.pan.y };
    }
    this.view.mode = mode;
    this.view.subMode = subMode;
    this.invalidate();
  }
  invalidate() {
    if (this.disposed) return;
    this.onChange();
    if (!this.pending)
      this.pending = requestAnimationFrame(() => {
        this.pending = 0;
        this.draw();
      });
  }
  draw() {
    const gl = this.gl;
    if (gl.isContextLost() || this.disposed) return;
    const v = this.view;
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.useProgram(this.program);
    gl.bindVertexArray(this.vao);
    for (let i = 0; i < 8; i++) {
      gl.activeTexture(gl.TEXTURE0 + i);
      gl.bindTexture(gl.TEXTURE_2D, this.textures[i] ?? this.blank);
      gl.uniform1i(this.location(`u_tex${i}`), i);
      const linear = v.filter === 'linear' || (v.filter === 'auto' && v.zoom < 1);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, linear ? gl.LINEAR : gl.NEAREST);
      gl.texParameteri(
        gl.TEXTURE_2D,
        gl.TEXTURE_MIN_FILTER,
        linear && this.textures[i] ? gl.LINEAR_MIPMAP_LINEAR : gl.NEAREST,
      );
    }
    gl.uniform1iv(
      this.location('u_present[0]'),
      this.frames.map((f) => (f ? 1 : 0)),
    );
    gl.uniform2fv(
      this.location('u_size[0]'),
      this.frames.flatMap((f) => [f?.width ?? 1, f?.height ?? 1]),
    );
    for (const [name, p] of Object.entries({
      u_canvas: { x: this.canvas.width, y: this.canvas.height },
      u_base: { x: this.base.width, y: this.base.height },
      u_pan: v.pan,
      u_mouse: v.mouse,
    }))
      gl.uniform2f(this.location(name), p.x, p.y);
    for (const [name, value] of Object.entries({
      u_zoom: v.zoom,
      u_gain: v.gain,
      u_bands: v.bandFrequency,
    }))
      gl.uniform1f(this.location(name), value);
    for (const [name, value] of Object.entries({
      u_mode: v.mode,
      u_sub: v.subMode,
      u_a: v.slotA,
      u_b: v.slotB,
      u_loupe: Number(v.loupe),
      u_grid: Number(v.grid),
    }))
      gl.uniform1i(this.location(name), value);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
  async capture(): Promise<Blob> {
    this.draw();
    return new Promise((resolve, reject) =>
      this.canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(Error('Unable to capture comparison.'))),
        'image/png',
      ),
    );
  }
  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.pending);
    this.observer.disconnect();
    window.removeEventListener('resize', this.resize);
    this.canvas.removeEventListener('webglcontextlost', this.contextLost);
    this.canvas.removeEventListener('webglcontextrestored', this.contextRestored);
    this.clear();
    this.gl.deleteTexture(this.blank);
    this.gl.deleteVertexArray(this.vao);
    this.gl.deleteProgram(this.program);
  }
}
