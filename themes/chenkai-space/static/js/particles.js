(function () {
  // Canvas particle field. Each dot trembles in its OWN random direction
  // (unlike the old CSS grid where every dot shared one transform), and the
  // field fills whatever element it's sized to (full viewport on /music/,
  // a small box in /admin/). All knobs are read from CSS custom properties
  // on `varSource`, so admin sliders and theme switches take effect live.
  const TAU = Math.PI * 2;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  // Hard cap so big/retina screens can't spawn 10k+ dots and overwhelm the
  // render process. Spacing grows past the user's gap once this is hit.
  const MAX_PARTICLES = 4000;
  // getComputedStyle + getBoundingClientRect are layout-flushing; reading them
  // every frame is wasteful. Refresh them a few times a second instead — still
  // responsive for admin sliders and theme switches.
  const READ_EVERY = 12;

  function ParticleField(canvas, varSource) {
    const ctx = canvas.getContext("2d");
    const start = performance.now();
    let W = 0, H = 0, particles = [], lastGap = null, frameNo = 0;
    let o = readVars();

    function readVars() {
      const cs = getComputedStyle(varSource);
      const n = (k, d) => {
        const v = parseFloat(cs.getPropertyValue(k));
        return isNaN(v) ? d : v;
      };
      return {
        gap: Math.max(6, n("--dot-gap", 16)),
        dotOpacity: n("--dot-opacity", 0.28),
        jitter: n("--jitter", 1),
        wavePeriod: Math.max(1, n("--wave-period", 8)),
        waveAngle: n("--wave-angle", 72),
        waveOpacity: n("--wave-opacity", 0.6),
        accent: (cs.getPropertyValue("--accent").trim() || "#999"),
      };
    }

    function resize() {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = Math.max(1, Math.round(rect.width));
      H = Math.max(1, Math.round(rect.height));
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    // Spacing that honours the user's gap but never yields more than the cap.
    function effectiveGap(gap) {
      const minGap = Math.sqrt((W * H) / MAX_PARTICLES);
      return Math.max(gap, minGap);
    }

    function buildGrid(gap) {
      const g = effectiveGap(gap);
      particles = [];
      for (let y = g / 2; y < H; y += g) {
        for (let x = g / 2; x < W; x += g) {
          particles.push({
            x, y,
            dir: Math.random() * TAU,          // own tremble direction
            amp: 0.5 + Math.random(),          // own amplitude
            speed: 1.3 + Math.random() * 1.8,  // own tremble speed
            phase: Math.random() * TAU,        // own phase offset
          });
        }
      }
      lastGap = gap;
    }

    function frame(now) {
      // Refresh size + CSS knobs only every few frames.
      if (frameNo % READ_EVERY === 0) {
        o = readVars();
        const rect = canvas.getBoundingClientRect();
        if (Math.round(rect.width) !== W || Math.round(rect.height) !== H) {
          resize();
          buildGrid(o.gap);
        } else if (o.gap !== lastGap) {
          buildGrid(o.gap);
        }
      }
      frameNo++;

      const t = reduce ? 0 : (now - start) / 1000;
      ctx.clearRect(0, 0, W, H);

      // A bright band sweeps across along waveAngle.
      const rad = (o.waveAngle * Math.PI) / 180;
      const wx = Math.cos(rad), wy = Math.sin(rad);
      const diag = Math.abs(W * wx) + Math.abs(H * wy);
      const band = Math.max(40, diag * 0.16);
      const sweep = reduce ? 0.5 : (t % o.wavePeriod) / o.wavePeriod;
      const center = -band + sweep * (diag + 2 * band);

      ctx.fillStyle = o.accent;
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        let px = p.x, py = p.y;
        if (!reduce) {
          const d = Math.sin(t * p.speed + p.phase) * p.amp * o.jitter * 1.7;
          px += Math.cos(p.dir) * d;
          py += Math.sin(p.dir) * d;
        }
        const k = reduce ? 0 : Math.max(0, 1 - Math.abs(px * wx + py * wy - center) / band);
        ctx.globalAlpha = Math.min(1, o.dotOpacity + k * o.waveOpacity);
        ctx.beginPath();
        ctx.arc(px, py, 1 + k * 1.2, 0, TAU);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      if (!reduce) requestAnimationFrame(frame);
    }

    resize();
    buildGrid(o.gap);
    if (reduce) {
      frame(0);
      window.addEventListener("resize", () => { resize(); buildGrid(o.gap); frame(0); });
    } else {
      requestAnimationFrame(frame);
    }
  }

  window.ParticleField = ParticleField;

  // Auto-mount the full-page field when present (the /music/ page).
  document.addEventListener("DOMContentLoaded", function () {
    const c = document.getElementById("page-particles");
    if (c) ParticleField(c, document.documentElement);
  });
})();
