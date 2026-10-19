"use client";

import { defaultFoilMask, type FoilMask } from "@sleevebook/binder-core";
import {
  type CSSProperties,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { sleeveOverlayStyle } from "../../lib/theme-presets";
import { usePrefersReducedMotion } from "../../lib/use-prefers-reduced-motion";
import { HoloCard } from "../binder/holo-card";

// Render level N3 (docs/PRODUCT.md 5.1): the focused card drawn with raw WebGL.
// One quad, one fragment shader: relief from the image luminance, thin-film
// foil and sparkle masked by the card's foil mask, and a pointer-driven tilt
// with springs. The rAF loop only runs while something is moving.

export interface HoloGlProps {
  imageUrl: string | null;
  name: string;
  variant: string;
  /** Foil mask (render level N4). Null or absent falls back to defaultFoilMask(variant). */
  mask?: FoilMask | null;
  width?: number;
  sleeve?: string;
}

const ASPECT_RATIO = 88 / 63;
const MAX_TILT_DEG = 12;
const MAX_DPR = 2;
const MAX_ZONES = 8;
const FRAME_STEP = 1 / 120;
const MAX_FRAME_DT = 1 / 30;

// Foil and light levels. At rest the card must look like the printed card.
const REST_FOIL = 0.1;
const ACTIVE_FOIL = 0.42;
const REST_SPEC = 0.02;
const ACTIVE_SPEC = 0.22;
const ACTIVE_GLARE = 0.08;
const RELIEF = 0.28;
const LIGHT_RANGE = 1.4;
const REST_LIGHT = { x: -0.3, y: 0.35 };

const MODE_CODES: Record<FoilMask["mode"], number> = { none: 0, inside: 1, outside: 2, full: 3 };

const VERTEX_SHADER = `
attribute vec2 aPos;
varying vec2 vUv;
void main() {
  vUv = vec2(aPos.x * 0.5 + 0.5, 0.5 - aPos.y * 0.5);
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

// GLSL ES 1.00 so the same source compiles in WebGL1 and WebGL2 contexts.
const FRAGMENT_SHADER = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
varying vec2 vUv;
uniform sampler2D uTex;
uniform vec2 uTexel;
uniform vec2 uLight;
uniform vec2 uPointer;
uniform vec2 uTilt;
uniform float uFoil;
uniform float uSpec;
uniform float uRelief;
uniform float uGlare;
uniform float uMode;
uniform float uZoneCount;
uniform vec4 uZones[${MAX_ZONES}];

const float FEATHER = 0.015;
const float RELIEF_SLOPE = 0.8;

float luma(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }
float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
vec3 thinFilm(float t) { return 0.5 + 0.5 * cos(6.2831853 * (t + vec3(0.0, 0.33, 0.67))); }
float overlayChannel(float b, float f) {
  return b < 0.5 ? 2.0 * b * f : 1.0 - 2.0 * (1.0 - b) * (1.0 - f);
}

void main() {
  vec2 uv = vUv;
  vec4 texel = texture2D(uTex, uv);

  // Relief: 3x3 Sobel on luminance (8 taps + the centre = 9 in total).
  float tl = luma(texture2D(uTex, uv + uTexel * vec2(-1.0, -1.0)).rgb);
  float tc = luma(texture2D(uTex, uv + uTexel * vec2(0.0, -1.0)).rgb);
  float tr = luma(texture2D(uTex, uv + uTexel * vec2(1.0, -1.0)).rgb);
  float ml = luma(texture2D(uTex, uv + uTexel * vec2(-1.0, 0.0)).rgb);
  float mr = luma(texture2D(uTex, uv + uTexel * vec2(1.0, 0.0)).rgb);
  float bl = luma(texture2D(uTex, uv + uTexel * vec2(-1.0, 1.0)).rgb);
  float bc = luma(texture2D(uTex, uv + uTexel * vec2(0.0, 1.0)).rgb);
  float br = luma(texture2D(uTex, uv + uTexel * vec2(1.0, 1.0)).rgb);
  float gx = (tr + 2.0 * mr + br) - (tl + 2.0 * ml + bl);
  float gy = (bl + 2.0 * bc + br) - (tl + 2.0 * tc + tr);

  vec3 n = normalize(vec3(-gx * RELIEF_SLOPE, -gy * RELIEF_SLOPE, 1.0));
  vec3 lightDir = normalize(vec3(uLight, 1.0));
  float shade = clamp(dot(n, lightDir) / lightDir.z, 0.6, 1.4);
  vec3 col = texel.rgb * mix(1.0, shade, uRelief);

  // Soft specular from the same light (kept low; text must stay crisp).
  vec3 halfVec = normalize(lightDir + vec3(0.0, 0.0, 1.0));
  float spec = pow(max(dot(n, halfVec), 0.0), 24.0) * uSpec;

  // Foil zones: inside = within any zone, outside = the complement.
  float inside = 0.0;
  for (int i = 0; i < ${MAX_ZONES}; i++) {
    if (float(i) >= uZoneCount) { break; }
    vec4 z = uZones[i];
    vec2 q = min(uv - z.xy, z.zw - uv);
    inside = max(inside, smoothstep(0.0, FEATHER, min(q.x, q.y)));
  }
  float w = uMode < 0.5 ? 0.0 : (uMode < 1.5 ? inside : (uMode < 2.5 ? 1.0 - inside : 1.0));

  // Thin-film iridescence: the hue follows position and view angle.
  float phase = dot(uv, vec2(0.9, 0.6)) * 2.2 + uTilt.x * 1.6 + uTilt.y * 1.1;
  vec3 film = thinFilm(phase);
  // A sheen band that travels with the light.
  float band = exp(-pow((dot(uv - 0.5, vec2(0.7071, 0.7071)) - (uLight.x - uLight.y) * 0.35) * 5.0, 2.0));
  float foil = uFoil * w * (0.35 + 0.65 * band);
  vec3 filmed = vec3(overlayChannel(col.r, film.r), overlayChannel(col.g, film.g), overlayChannel(col.b, film.b));
  col = mix(col, filmed, foil);
  // Shimmer lifts the darks a little, like light through a thin film.
  col = 1.0 - (1.0 - col) * (1.0 - film * foil * 0.05);

  // Sparkle: rare, soft round glints (never whole square cells -- those read
  // as dead white pixels), each at a random spot inside its cell, twinkling
  // with the tilt. Cells are square on the 63:88 card.
  vec2 g = uv * vec2(63.0, 88.0);
  vec2 cell = floor(g);
  float h = hash(cell);
  vec2 center = vec2(hash(cell + 1.7), hash(cell + 4.3)) * 0.6 + 0.2;
  vec2 dv = fract(g) - center;
  float glint = exp(-dot(dv, dv) * 28.0);
  float star = smoothstep(0.990, 0.997, h);
  float twinkle = pow(max(sin(h * 40.0 + uTilt.x * 9.0 + uTilt.y * 7.0), 0.0), 10.0);
  col += star * twinkle * glint * w * uFoil * vec3(1.0, 0.97, 0.9);

  // Glare pool that follows the pointer, and the specular.
  float d = distance(uv, uPointer);
  vec3 glare = uGlare * exp(-d * d * 9.0) * vec3(1.0, 0.97, 0.92) + spec * vec3(1.0, 0.98, 0.95);
  col = 1.0 - (1.0 - col) * (1.0 - glare);

  gl_FragColor = vec4(clamp(col, 0.0, 1.0) * texel.a, texel.a);
}`;

const UNIFORM_NAMES = [
  "uTex",
  "uTexel",
  "uLight",
  "uPointer",
  "uTilt",
  "uFoil",
  "uSpec",
  "uRelief",
  "uGlare",
  "uMode",
  "uZoneCount",
  "uZones",
] as const;
type UniformName = (typeof UNIFORM_NAMES)[number];

type GL = WebGLRenderingContext;

interface GlState {
  gl: GL;
  program: WebGLProgram;
  buffer: WebGLBuffer;
  texture: WebGLTexture;
  uniforms: Record<UniformName, WebGLUniformLocation | null>;
  mipmaps: boolean;
  ready: boolean;
}

interface Spring {
  x: number;
  v: number;
  t: number;
  k: number;
  c: number;
}

interface Motion {
  rx: Spring; // tilt around X, degrees
  ry: Spring; // tilt around Y, degrees
  lx: Spring; // light direction, card space
  ly: Spring;
  active: Spring; // 0 at rest, 1 while the pointer is over the card
  all: Spring[];
}

interface MaskUniforms {
  mode: number;
  count: number;
  zones: Float32Array;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function spring(x: number, k: number, c: number): Spring {
  return { x, v: 0, t: x, k, c };
}

function createMotion(): Motion {
  const rx = spring(0, 300, 24);
  const ry = spring(0, 300, 24);
  const lx = spring(REST_LIGHT.x, 160, 26);
  const ly = spring(REST_LIGHT.y, 160, 26);
  const active = spring(0, 160, 26);
  return { rx, ry, lx, ly, active, all: [rx, ry, lx, ly, active] };
}

// Semi-implicit Euler on damped springs, sub-stepped for stability.
function stepMotion(motion: Motion, dt: number): boolean {
  const steps = Math.max(1, Math.ceil(dt / FRAME_STEP));
  const h = dt / steps;
  for (let i = 0; i < steps; i++) {
    for (const s of motion.all) {
      s.v += (s.k * (s.t - s.x) - s.c * s.v) * h;
      s.x += s.v * h;
    }
  }
  return motion.all.every((s) => Math.abs(s.t - s.x) < 1e-4 && Math.abs(s.v) < 1e-3);
}

function maskUniforms(mask: FoilMask): MaskUniforms {
  const zones = new Float32Array(MAX_ZONES * 4);
  const list = mask.mode === "full" ? [] : mask.zones.slice(0, MAX_ZONES);
  list.forEach((z, i) => {
    zones[i * 4] = z.x;
    zones[i * 4 + 1] = z.y;
    zones[i * 4 + 2] = z.x + z.w;
    zones[i * 4 + 3] = z.y + z.h;
  });
  return { mode: MODE_CODES[mask.mode], count: list.length, zones };
}

function compileShader(gl: GL, type: number, source: string): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) {
    return null;
  }
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

function buildProgram(gl: GL): WebGLProgram | null {
  const vertex = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
  const fragment = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
  if (!vertex || !fragment) {
    return null;
  }
  const program = gl.createProgram();
  if (!program) {
    return null;
  }
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    gl.deleteProgram(program);
    return null;
  }
  return program;
}

function createGl(canvas: HTMLCanvasElement): { gl: GL; webgl2: boolean } | null {
  const attributes = {
    alpha: true,
    premultipliedAlpha: true,
    antialias: false,
    depth: false,
    stencil: false,
    preserveDrawingBuffer: false,
  };
  // WebGL2 is a superset; the WebGL1 typings cover every call made here.
  const gl2 = canvas.getContext("webgl2", attributes) as GL | null;
  if (gl2) {
    return { gl: gl2, webgl2: true };
  }
  const gl1 = canvas.getContext("webgl", attributes) as GL | null;
  return gl1 ? { gl: gl1, webgl2: false } : null;
}

function uploadTexture(state: GlState, image: HTMLImageElement) {
  const { gl, texture, mipmaps } = state;
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  if (mipmaps) {
    // WebGL2 allows mipmaps on non-power-of-two textures; WebGL1 does not.
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  } else {
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  }
}

export function HoloGl({
  imageUrl,
  name,
  variant,
  mask,
  width = 260,
  sleeve = "clear",
}: HoloGlProps) {
  // The failed URL is remembered, so a new image gets a fresh attempt.
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const handleFail = useCallback(() => {
    if (imageUrl) {
      setFailedUrl(imageUrl);
    }
  }, [imageUrl]);

  if (!imageUrl || failedUrl === imageUrl) {
    return (
      <HoloCard
        imageUrl={imageUrl}
        name={name}
        variant={variant}
        mask={mask}
        sleeve={sleeve}
        width={width}
      />
    );
  }

  return (
    <HoloGlView
      key={imageUrl}
      imageUrl={imageUrl}
      name={name}
      variant={variant}
      mask={mask}
      width={width}
      sleeve={sleeve}
      onFail={handleFail}
    />
  );
}

function HoloGlView({
  imageUrl,
  name,
  variant,
  mask,
  width,
  sleeve,
  onFail,
}: {
  imageUrl: string;
  name: string;
  variant: string;
  mask: FoilMask | null | undefined;
  width: number;
  sleeve: string;
  onFail: () => void;
}) {
  const reduced = usePrefersReducedMotion();
  const height = Math.round(width * ASPECT_RATIO);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [motion] = useState(createMotion);
  // Set by the GL effect; a no-op until the canvas has a context.
  const requestRef = useRef<() => void>(() => {});

  const maskData = useMemo(() => maskUniforms(mask ?? defaultFoilMask(variant)), [mask, variant]);
  const maskRef = useRef<MaskUniforms>(maskData);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    requestRef.current();
  }, [width, height]);

  useEffect(() => {
    maskRef.current = maskData;
    requestRef.current();
  }, [maskData]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrapper = wrapperRef.current;
    if (!canvas || !wrapper) {
      return;
    }
    // Narrowed copies: the inner function declarations below do not keep narrowing.
    const canvasEl = canvas;
    const wrapperEl = wrapper;

    let disposed = false;
    let rafId = 0;
    let lastNow = 0;
    let state: GlState | null = null;
    const image = new Image();
    image.decoding = "async";
    const loader = new AbortController();
    let objectUrl: string | null = null;

    function initGl(): boolean {
      const context = createGl(canvasEl);
      if (!context) {
        return false;
      }
      const { gl, webgl2 } = context;
      const program = buildProgram(gl);
      if (!program) {
        return false;
      }
      // biome-ignore lint/correctness/useHookAtTopLevel: WebGL's useProgram, not a React hook
      gl.useProgram(program);
      const buffer = gl.createBuffer();
      const texture = gl.createTexture();
      if (!buffer || !texture) {
        return false;
      }
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
        gl.STATIC_DRAW,
      );
      const aPos = gl.getAttribLocation(program, "aPos");
      gl.enableVertexAttribArray(aPos);
      gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
      const uniforms = {} as Record<UniformName, WebGLUniformLocation | null>;
      for (const uniformName of UNIFORM_NAMES) {
        uniforms[uniformName] = gl.getUniformLocation(program, uniformName);
      }
      gl.uniform1i(uniforms.uTex, 0);
      state = { gl, program, buffer, texture, uniforms, mipmaps: webgl2, ready: false };
      if (image.complete && image.naturalWidth > 0) {
        uploadTexture(state, image);
        state.ready = true;
      }
      return true;
    }

    function draw() {
      if (!state?.ready || state.gl.isContextLost()) {
        return;
      }
      const { gl, uniforms } = state;
      const mask = maskRef.current;
      const active = clamp(motion.active.x, 0, 1);
      const lightX = motion.lx.x;
      const lightY = motion.ly.x;
      gl.viewport(0, 0, canvasEl.width, canvasEl.height);
      gl.uniform2f(uniforms.uTexel, 1 / image.naturalWidth, 1 / image.naturalHeight);
      gl.uniform2f(uniforms.uLight, lightX, lightY);
      gl.uniform2f(uniforms.uPointer, lightX / LIGHT_RANGE + 0.5, 0.5 - lightY / LIGHT_RANGE);
      gl.uniform2f(uniforms.uTilt, motion.rx.x / MAX_TILT_DEG, motion.ry.x / MAX_TILT_DEG);
      gl.uniform1f(uniforms.uFoil, REST_FOIL + (ACTIVE_FOIL - REST_FOIL) * active);
      gl.uniform1f(uniforms.uSpec, REST_SPEC + (ACTIVE_SPEC - REST_SPEC) * active);
      gl.uniform1f(uniforms.uGlare, ACTIVE_GLARE * active);
      gl.uniform1f(uniforms.uRelief, RELIEF);
      gl.uniform1f(uniforms.uMode, mask.mode);
      gl.uniform1f(uniforms.uZoneCount, mask.count);
      gl.uniform4fv(uniforms.uZones, mask.zones);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }

    function frame(now: number) {
      rafId = 0;
      const dt = lastNow ? Math.min((now - lastNow) / 1000, MAX_FRAME_DT) : 1 / 60;
      lastNow = now;
      const settled = stepMotion(motion, dt);
      wrapperEl.style.transform = `rotateX(${motion.rx.x}deg) rotateY(${motion.ry.x}deg)`;
      draw();
      if (settled) {
        lastNow = 0;
      } else {
        rafId = requestAnimationFrame(frame);
      }
    }

    function request() {
      if (!disposed && !rafId) {
        rafId = requestAnimationFrame(frame);
      }
    }

    function handleLost(event: Event) {
      // Preventing the default asks the browser to restore the context.
      event.preventDefault();
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = 0;
      }
      state = null;
    }

    function handleRestored() {
      if (disposed) {
        return;
      }
      if (!initGl()) {
        onFail();
        return;
      }
      request();
    }

    if (!initGl()) {
      onFail();
      return;
    }

    image.onload = () => {
      if (disposed || !state) {
        return;
      }
      try {
        uploadTexture(state, image);
        state.ready = true;
        request();
      } catch {
        // A cross-origin image without CORS taints the texture and throws.
        onFail();
      }
    };
    image.onerror = () => {
      if (!disposed) {
        onFail();
      }
    };
    // Fetch in CORS mode and give the image a same-origin blob URL. A plain
    // <img crossOrigin> reuses the copy the binder thumbnails already cached
    // without CORS headers and fails; cache "reload" skips that copy.
    fetch(imageUrl, {
      mode: "cors",
      cache: "reload",
      credentials: "omit",
      signal: loader.signal,
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        return response.blob();
      })
      .then((blob) => {
        if (disposed) {
          return;
        }
        objectUrl = URL.createObjectURL(blob);
        image.src = objectUrl;
      })
      .catch(() => {
        if (!disposed) {
          onFail();
        }
      });

    canvasEl.addEventListener("webglcontextlost", handleLost);
    canvasEl.addEventListener("webglcontextrestored", handleRestored);
    requestRef.current = request;
    request();

    return () => {
      disposed = true;
      requestRef.current = () => {};
      loader.abort();
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
      if (rafId) {
        cancelAnimationFrame(rafId);
      }
      canvasEl.removeEventListener("webglcontextlost", handleLost);
      canvasEl.removeEventListener("webglcontextrestored", handleRestored);
      image.onload = null;
      image.onerror = null;
      if (state && !state.gl.isContextLost()) {
        const { gl, program, buffer, texture } = state;
        gl.deleteTexture(texture);
        gl.deleteBuffer(buffer);
        gl.deleteProgram(program);
      }
      state = null;
    };
  }, [imageUrl, motion, onFail]);

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const element = wrapperRef.current;
    if (!element) {
      return;
    }
    const rect = element.getBoundingClientRect();
    const px = clamp((event.clientX - rect.left) / rect.width, 0, 1);
    const py = clamp((event.clientY - rect.top) / rect.height, 0, 1);
    motion.rx.t = (0.5 - py) * MAX_TILT_DEG;
    motion.ry.t = (px - 0.5) * MAX_TILT_DEG;
    motion.lx.t = (px - 0.5) * LIGHT_RANGE;
    motion.ly.t = (0.5 - py) * LIGHT_RANGE;
    motion.active.t = 1;
    requestRef.current();
  }

  function handlePointerLeave() {
    motion.rx.t = 0;
    motion.ry.t = 0;
    motion.lx.t = REST_LIGHT.x;
    motion.ly.t = REST_LIGHT.y;
    motion.active.t = 0;
    requestRef.current();
  }

  const sleeveStyle = sleeveOverlayStyle(sleeve);
  const wrapperStyle: CSSProperties = {
    width,
    height,
    borderRadius: 12,
    position: "relative",
    overflow: "hidden",
    boxShadow: "0 12px 30px rgba(0,0,0,0.35)",
    background: "#ddd",
    touchAction: "none",
  };

  return (
    <div style={{ perspective: 1000 }}>
      <div
        ref={wrapperRef}
        onPointerMove={reduced ? undefined : handlePointerMove}
        onPointerLeave={reduced ? undefined : handlePointerLeave}
        style={wrapperStyle}
      >
        <canvas
          ref={canvasRef}
          data-testid="holo-gl"
          role="img"
          aria-label={name}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            display: "block",
          }}
        />
        {sleeveStyle && (
          <div style={{ position: "absolute", inset: 0, pointerEvents: "none", ...sleeveStyle }} />
        )}
      </div>
    </div>
  );
}
