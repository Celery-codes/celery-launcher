'use strict';
// Canvas particle system - floating dots with optional connection lines
class ParticleSystem {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.particles = [];
    this.running = false;
    this.animId = null;
    this._resizeH = null;
    this.config = {
      count: 40,
      maxSize: 2.4,
      speed: 0.5,
      opacity: 0.5,
      color: '#4ade80',
      lines: true,
      lineDist: 130
    };
  }

  updateConfig(cfg) {
    const needsRespawn = cfg.count !== undefined && cfg.count !== this.config.count;
    Object.assign(this.config, cfg);
    if (needsRespawn || !this.particles.length) this._spawn();
  }

  _resize() {
    this.canvas.width  = window.innerWidth;
    this.canvas.height = window.innerHeight;
    this._spawn();
  }

  _spawn() {
    const { count, maxSize, speed } = this.config;
    const w = this.canvas.width, h = this.canvas.height;
    this.particles = Array.from({ length: count }, () => ({
      x:  Math.random() * w,
      y:  Math.random() * h,
      vx: (Math.random() - 0.5) * speed,
      vy: (Math.random() - 0.5) * speed,
      r:  Math.random() * maxSize + 0.7,
      ph: Math.random() * Math.PI * 2
    }));
  }

  _tick() {
    const { ctx, canvas, particles, config } = this;
    const w = canvas.width, h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    const now = performance.now() / 1000;
    const col = config.color;

    for (const p of particles) {
      p.x += p.vx; p.y += p.vy;
      if (p.x < -10)  p.x = w + 10;
      if (p.x > w+10) p.x = -10;
      if (p.y < -10)  p.y = h + 10;
      if (p.y > h+10) p.y = -10;

      const alpha = config.opacity * (0.5 + 0.5 * Math.sin(now * 0.8 + p.ph));
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = col;
      ctx.globalAlpha = alpha;
      ctx.fill();
    }

    if (config.lines) {
      const dist = config.lineDist;
      ctx.lineWidth = 0.6;
      ctx.strokeStyle = col;
      for (let i = 0; i < particles.length - 1; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const d2 = dx*dx + dy*dy;
          if (d2 < dist * dist) {
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.globalAlpha = config.opacity * (1 - Math.sqrt(d2) / dist) * 0.22;
            ctx.stroke();
          }
        }
      }
    }

    ctx.globalAlpha = 1;
  }

  start() {
    this.running = true;
    this._resize();
    this._resizeH = () => this._resize();
    window.addEventListener('resize', this._resizeH);
    const loop = () => {
      if (!this.running) return;
      this._tick();
      this.animId = requestAnimationFrame(loop);
    };
    loop();
  }

  stop() {
    this.running = false;
    if (this.animId) { cancelAnimationFrame(this.animId); this.animId = null; }
    if (this._resizeH) { window.removeEventListener('resize', this._resizeH); this._resizeH = null; }
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }
}
