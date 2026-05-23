import { useEffect, useRef } from 'react';

const VERT = `
  attribute vec2 a_position;
  varying vec2 vUv;
  void main() {
    vUv = a_position * 0.5 + 0.5;
    gl_Position = vec4(a_position, 0.0, 1.0);
  }
`;

// Macaron soft blobs — large, slow-drifting, additive blending
const FRAG = `
  precision mediump float;
  uniform float u_time;
  uniform vec2 u_resolution;
  varying vec2 vUv;

  float blob(vec2 uv, vec2 center, float radius) {
    float d = distance(uv, center);
    return exp(-d * d / (radius * radius));
  }

  void main() {
    vec2 uv = vUv;
    float t = u_time * 0.15;

    vec3 finalColor = vec3(0.0);

    // Rose quartz
    float r0 = 0.22 + sin(t*0.3)*0.03;
    vec2 c0 = vec2(0.20 + sin(t*0.7+0.0)*0.18 + cos(t*0.3)*0.08, 0.25 + cos(t*0.5+0.0)*0.15 + sin(t*0.25)*0.06);
    finalColor += vec3(0.85, 0.68, 0.73) * blob(uv, c0, r0) * 0.45;

    // Mint sage
    float r1 = 0.20 + sin(t*0.25+1.0)*0.03;
    vec2 c1 = vec2(0.72 + sin(t*0.6+1.3)*0.16 + cos(t*0.28+0.5)*0.07, 0.48 + cos(t*0.45+1.3)*0.14 + sin(t*0.2+0.8)*0.06);
    finalColor += vec3(0.68, 0.82, 0.78) * blob(uv, c1, r1) * 0.40;

    // Lavender
    float r2 = 0.24 + sin(t*0.35+2.0)*0.04;
    vec2 c2 = vec2(0.45 + sin(t*0.65+2.6)*0.17 + cos(t*0.22+1.2)*0.08, 0.70 + cos(t*0.55+2.6)*0.13 + sin(t*0.3+1.5)*0.07);
    finalColor += vec3(0.72, 0.72, 0.88) * blob(uv, c2, r2) * 0.42;

    // Warm sand
    float r3 = 0.18 + sin(t*0.28+3.0)*0.03;
    vec2 c3 = vec2(0.80 + sin(t*0.55+3.9)*0.14 + cos(t*0.32+2.0)*0.06, 0.30 + cos(t*0.4+3.9)*0.12 + sin(t*0.18+2.5)*0.06);
    finalColor += vec3(0.82, 0.78, 0.68) * blob(uv, c3, r3) * 0.38;

    // Baby blue
    float r4 = 0.21 + sin(t*0.3+4.0)*0.03;
    vec2 c4 = vec2(0.28 + sin(t*0.6+5.2)*0.15 + cos(t*0.26+3.0)*0.07, 0.55 + cos(t*0.5+5.2)*0.14 + sin(t*0.22+3.5)*0.06);
    finalColor += vec3(0.68, 0.80, 0.88) * blob(uv, c4, r4) * 0.40;

    // Blush
    float r5 = 0.19 + sin(t*0.22+5.0)*0.03;
    vec2 c5 = vec2(0.62 + sin(t*0.5+6.5)*0.16 + cos(t*0.3+4.0)*0.07, 0.80 + cos(t*0.38+6.5)*0.12 + sin(t*0.2+4.5)*0.06);
    finalColor += vec3(0.82, 0.72, 0.78) * blob(uv, c5, r5) * 0.38;

    // Pistachio
    float r6 = 0.23 + sin(t*0.32+6.0)*0.04;
    vec2 c6 = vec2(0.15 + sin(t*0.62+7.8)*0.17 + cos(t*0.28+5.0)*0.07, 0.50 + cos(t*0.48+7.8)*0.14 + sin(t*0.25+5.5)*0.06);
    finalColor += vec3(0.78, 0.85, 0.72) * blob(uv, c6, r6) * 0.40;

    // Peach
    float r7 = 0.20 + sin(t*0.27+7.0)*0.03;
    vec2 c7 = vec2(0.55 + sin(t*0.52+9.1)*0.15 + cos(t*0.24+6.0)*0.07, 0.38 + cos(t*0.35+9.1)*0.13 + sin(t*0.2+6.5)*0.06);
    finalColor += vec3(0.88, 0.82, 0.72) * blob(uv, c7, r7) * 0.40;

    float alpha = clamp(length(finalColor), 0.0, 1.0);
    gl_FragColor = vec4(finalColor, alpha);
  }
`;

interface Props {
  opacity?: number;
}

function createShader(gl: WebGLRenderingContext, type: number, source: string): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

function createProgram(gl: WebGLRenderingContext, vs: WebGLShader, fs: WebGLShader): WebGLProgram | null {
  const program = gl.createProgram();
  if (!program) return null;
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    gl.deleteProgram(program);
    return null;
  }
  return program;
}


export default function GooeyBackground({ opacity = 1 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef<number>(0);
  const runningRef = useRef(true);
  const lastFrameTimeRef = useRef(0);

  const TARGET_FPS = 12;
  const FRAME_INTERVAL = 1000 / TARGET_FPS;
  const DPR = 0.25;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext('webgl', { antialias: false, alpha: true });
    if (!gl) return;
    const GL = gl; // non-null alias for TypeScript

    const vs = createShader(GL, GL.VERTEX_SHADER, VERT);
    const fs = createShader(GL, GL.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) return;

    const program = createProgram(GL, vs, fs);
    if (!program) return;

    // Full-screen quad
    const posBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);

    const aPosition = gl.getAttribLocation(program, 'aPosition');
    const uTime = gl.getUniformLocation(program, 'u_time');
    const uResolution = gl.getUniformLocation(program, 'u_resolution');

    const w = window.innerWidth;
    const h = window.innerHeight;
    canvas.width = w * DPR;
    canvas.height = h * DPR;
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    GL.viewport(0, 0, canvas.width, canvas.height);

    const startTime = performance.now();
    runningRef.current = true;

    function render() {
      GL.useProgram(program);
      GL.bindBuffer(GL.ARRAY_BUFFER, posBuffer);
      GL.enableVertexAttribArray(aPosition);
      GL.vertexAttribPointer(aPosition, 2, GL.FLOAT, false, 0, 0);
      GL.uniform1f(uTime, (performance.now() - startTime) / 1000);
      GL.uniform2f(uResolution, canvas!.width, canvas!.height);
      GL.drawArrays(GL.TRIANGLE_STRIP, 0, 4);
    }

    function animate(now: number) {
      if (!runningRef.current) {
        frameRef.current = requestAnimationFrame(animate);
        return;
      }
      const elapsed = now - lastFrameTimeRef.current;
      if (elapsed >= FRAME_INTERVAL) {
        lastFrameTimeRef.current = now - (elapsed % FRAME_INTERVAL);
        render();
      }
      frameRef.current = requestAnimationFrame(animate);
    }

    frameRef.current = requestAnimationFrame(animate);

    function onResize() {
      const nw = window.innerWidth;
      const nh = window.innerHeight;
      canvas!.width = nw * DPR;
      canvas!.height = nh * DPR;
      GL.viewport(0, 0, canvas!.width, canvas!.height);
    }
    window.addEventListener('resize', onResize);

    return () => {
      runningRef.current = false;
      cancelAnimationFrame(frameRef.current);
      window.removeEventListener('resize', onResize);
      GL.deleteProgram(program);
      GL.deleteShader(vs);
      GL.deleteShader(fs);
      GL.deleteBuffer(posBuffer);
    };
  }, []);

  useEffect(() => {
    runningRef.current = opacity > 0.05;
  }, [opacity]);

  return (
    <>
      {/* CSS gradient fallback — always visible */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 0,
          opacity: opacity * 0.4,
          pointerEvents: 'none',
          background: `
            radial-gradient(ellipse 250px 200px at 18% 25%, rgba(217,174,186,0.25), transparent),
            radial-gradient(ellipse 220px 220px at 72% 45%, rgba(174,210,199,0.22), transparent),
            radial-gradient(ellipse 200px 180px at 42% 72%, rgba(184,184,224,0.24), transparent),
            radial-gradient(ellipse 180px 160px at 82% 28%, rgba(209,199,174,0.20), transparent),
            radial-gradient(ellipse 200px 190px at 28% 58%, rgba(174,204,224,0.22), transparent),
            radial-gradient(ellipse 180px 170px at 65% 82%, rgba(209,184,199,0.20), transparent),
            radial-gradient(ellipse 230px 200px at 12% 52%, rgba(199,217,184,0.22), transparent),
            radial-gradient(ellipse 210px 180px at 55% 38%, rgba(224,209,184,0.22), transparent)
          `,
          animation: 'bgDrift 30s ease-in-out infinite alternate',
        }}
      />
      {/* WebGL layer */}
      <canvas
        ref={canvasRef}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          zIndex: 1,
          opacity,
          pointerEvents: 'none',
        }}
      />
    </>
  );
}
