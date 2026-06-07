(function () {
  // Canvas particle field. Each dot trembles in its OWN random direction
  // (unlike the old CSS grid where every dot shared one transform), and the
  // field fills whatever element it's sized to (full viewport on /music/,
  // a small box in /admin/). All knobs are read live from CSS custom
  // properties on `varSource`, so admin sliders and theme switches take
  // effect without rebuilding.
  const TAU = Math.PI * 2;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function ParticleField(canvas, varSource) {
    const ctx = canvas.getContext("2d");
    const start = performance.now();
    let W = 0, H = 0, particles = [], lastGap = null;

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

    function buildGrid(gap) {
      particles = [];
      for (let y = gap / 2; y < H; y += gap) {
        for (let x = gap / 2; x < W; x += gap) {
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
      const o = readVars();
      const rect = canvas.getBoundingClientRect();
      if (Math.round(rect.width) !== W || Math.round(rect.height) !== H) {
        resize();
        buildGrid(o.gap);
      } else if (o.gap !== lastGap) {
        buildGrid(o.gap);
      }

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
    buildGrid(readVars().gap);
    if (reduce) {
      frame(0);
      window.addEventListener("resize", () => frame(0));
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
