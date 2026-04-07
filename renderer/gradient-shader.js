'use strict';
// WebGL animated stripe gradient - inspired by Stripe/GradFlow
class GradientShader {
  constructor(canvas) {
    this.canvas = canvas;
    this.gl = null;
    this.program = null;
    this.u = null;
    this.running = false;
    this.animId = null;
    this.t0 = performance.now();
    this.config = {
      color1: { r:13,  g:15,  b:14  },
      color2: { r:74,  g:222, b:128 },
      color3: { r:22,  g:163, b:74  },
      speed: 0.4, scale: 1.2, noise: 0.12
    };
    this._initGL();
  }

  _initGL() {
    const gl = this.canvas.getContext('webgl', { alpha:false, antialias:false, depth:false });
    if (!gl) { console.warn('GradientShader: WebGL unavailable'); return; }
    this.gl = gl;

    const vert = `attribute vec2 p;void main(){gl_Position=vec4(p,0,1);}`;

    // Compact GLSL names to avoid issues with special chars
    const frag = `
precision mediump float;
uniform float T;
uniform vec2  RES;
uniform vec3  C1,C2,C3;
uniform float SP,SC,NO;

float h2(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float sn(vec2 p){
  vec2 i=floor(p),f=fract(p);
  f=f*f*(3.0-2.0*f);
  return mix(mix(h2(i),h2(i+vec2(1,0)),f.x),
             mix(h2(i+vec2(0,1)),h2(i+vec2(1,1)),f.x),f.y);
}
float fbm(vec2 p){return sn(p)*.5+sn(p*2.1)*.25+sn(p*4.2)*.125;}

void main(){
  vec2 uv=gl_FragCoord.xy/RES;
  float t=T*SP;
  float n=fbm(uv*SC+vec2(t*.11,t*.07))*NO*4.0;
  float s1=sin((uv.x-uv.y*.6+n+t*.18)*6.2832*2.5)*.5+.5;
  float s2=sin((uv.x*1.4+uv.y+n*1.2-t*.14)*6.2832*1.8)*.5+.5;
  float s3=sin((uv.y*.9-uv.x*.4+n*.7+t*.09)*6.2832*1.3)*.5+.5;
  vec3 c=mix(C1,C2,s1);
  c=mix(c,C3,s2*.6);
  c=mix(c,C1*.6+C3*.4,s3*.25);
  float v=1.0-length((uv-.5)*1.5);
  v=clamp(v,0.0,1.0);
  c*=mix(.58,1.0,pow(v,.4));
  gl_FragColor=vec4(c,1.0);
}`;

    const vs = this._compile(gl.VERTEX_SHADER, vert);
    const fs = this._compile(gl.FRAGMENT_SHADER, frag);
    if (!vs || !fs) return;

    const prg = gl.createProgram();
    gl.attachShader(prg, vs);
    gl.attachShader(prg, fs);
    gl.linkProgram(prg);
    if (!gl.getProgramParameter(prg, gl.LINK_STATUS)) {
      console.error('GradientShader link error:', gl.getProgramInfoLog(prg));
      return;
    }
    this.program = prg;

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prg, 'p');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    gl.useProgram(prg);

    this.u = {
      T:   gl.getUniformLocation(prg, 'T'),
      RES: gl.getUniformLocation(prg, 'RES'),
      C1:  gl.getUniformLocation(prg, 'C1'),
      C2:  gl.getUniformLocation(prg, 'C2'),
      C3:  gl.getUniformLocation(prg, 'C3'),
      SP:  gl.getUniformLocation(prg, 'SP'),
      SC:  gl.getUniformLocation(prg, 'SC'),
      NO:  gl.getUniformLocation(prg, 'NO'),
    };
  }

  _compile(type, src) {
    const s = this.gl.createShader(type);
    this.gl.shaderSource(s, src);
    this.gl.compileShader(s);
    if (!this.gl.getShaderParameter(s, this.gl.COMPILE_STATUS)) {
      console.error('Shader compile error:', this.gl.getShaderInfoLog(s));
      return null;
    }
    return s;
  }

  _resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.canvas.width = w; this.canvas.height = h;
    if (this.gl) this.gl.viewport(0, 0, w, h);
  }

  _frame() {
    const { gl, u, config } = this;
    if (!gl || !u) return;
    const t = (performance.now() - this.t0) / 1000;
    const c1 = config.color1, c2 = config.color2, c3 = config.color3;
    gl.uniform1f(u.T, t);
    gl.uniform2f(u.RES, this.canvas.width, this.canvas.height);
    gl.uniform3f(u.C1, c1.r/255, c1.g/255, c1.b/255);
    gl.uniform3f(u.C2, c2.r/255, c2.g/255, c2.b/255);
    gl.uniform3f(u.C3, c3.r/255, c3.g/255, c3.b/255);
    gl.uniform1f(u.SP, config.speed);
    gl.uniform1f(u.SC, config.scale);
    gl.uniform1f(u.NO, config.noise);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  updateConfig(cfg) {
    Object.assign(this.config, cfg);
  }

  start() {
    if (!this.gl || !this.program) return false;
    this.running = true;
    this._resize();
    this._onResize = () => this._resize();
    window.addEventListener('resize', this._onResize);
    const loop = () => {
      if (!this.running) return;
      this._frame();
      this.animId = requestAnimationFrame(loop);
    };
    loop();
    return true;
  }

  stop() {
    this.running = false;
    if (this.animId) { cancelAnimationFrame(this.animId); this.animId = null; }
    if (this._onResize) { window.removeEventListener('resize', this._onResize); this._onResize = null; }
  }
}
