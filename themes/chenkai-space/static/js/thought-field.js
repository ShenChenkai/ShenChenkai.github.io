/**
 * Thought-field — a full-viewport ambient background for /thoughts/.
 *
 * On load, tangled branches grow outward from several seeds and knot across the
 * whole page; wherever a branch forks or ends, a neuron-like node settles in.
 * Once grown, the field idles: nodes breathe, and now and then a synapse fires
 * between two neighbours (a pulse travels the link). Branch + neuron fused —
 * the feed reads on top, this canvas is mood only (no clicks, no cards).
 *
 * Pure canvas, no real data: density scales with how many thoughts exist
 * (canvas `data-count`). Colours come from --accent / --text so it stays
 * visible in both light and dark mode. Honours prefers-reduced-motion by
 * drawing the finished field once, with no animation.
 *
 * Two layers: branches accumulate on an offscreen canvas (drawn once as they
 * grow, never re-stroked); each frame the main canvas blits that layer, then
 * paints the live bits — node glow + firing synapses — on top.
 */
(function () {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const TAU = Math.PI * 2;
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

  function field(canvas) {
    const ctx = canvas.getContext("2d");
    const branchLayer = document.createElement("canvas");
    const bctx = branchLayer.getContext("2d");
    const count = Number(canvas.dataset.count || 6);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    let W = 0, H = 0, raf = 0, colors = readColors(), glow = null;
    let tips = [], nodes = [], synapses = [], growing = true, fireAt = 0;

    function readColors() {
      const cs = getComputedStyle(document.documentElement);
      const accent = cs.getPropertyValue("--accent").trim() || "#888";
      return { line: accent, node: accent };
    }

    // Soft round glow sprite (built once per palette) — far cheaper than
    // shadowBlur per node when there are ~100 of them every frame.
    function makeGlow(color) {
      const s = 64, g = document.createElement("canvas");
      g.width = g.height = s;
      const gx = g.getContext("2d");
      const grad = gx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
      grad.addColorStop(0, color);
      grad.addColorStop(0.35, color);
      grad.addColorStop(1, "transparent");
      gx.fillStyle = grad;
      gx.fillRect(0, 0, s, s);
      return g;
    }

    function size() {
      W = window.innerWidth;
      H = window.innerHeight;
      for (const c of [canvas, branchLayer]) {
        c.width = W * dpr;
        c.height = H * dpr;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      bctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    // Seed origins on a jittered grid so growth covers the whole viewport
    // rather than clumping. More thoughts → a few more seeds → denser tangle.
    function seed() {
      bctx.clearRect(0, 0, W, H);
      tips = []; nodes = []; synapses = []; growing = true;
      bctx.lineCap = "round";
      bctx.lineJoin = "round";

      const seeds = clamp(Math.round(4 + count * 0.7), 5, 11);
      const cols = Math.ceil(Math.sqrt(seeds * (W / H)));
      const rows = Math.ceil(seeds / cols);
      for (let gy = 0; gy < rows; gy++) {
        for (let gx = 0; gx < cols; gx++) {
          if (tips.length >= seeds) break;
          const x = (gx + 0.2 + Math.random() * 0.6) * (W / cols);
          const y = (gy + 0.2 + Math.random() * 0.6) * (H / rows);
          tips.push({ x, y, a: Math.random() * TAU, gen: 0, life: 22 + Math.random() * 14, w: 2.4 });
          nodes.push({ x, y, r: 2.6, phase: Math.random() * TAU });
        }
      }
    }

    const SEG_CAP = 1400;     // total branch segments across the field
    const TIP_CAP = 140;      // live growing tips at any moment
    const NODE_CAP = 220;
    let segCount = 0;

    function dropNode(x, y, gen) {
      if (nodes.length >= NODE_CAP) return;
      nodes.push({ x, y, r: clamp(3.2 - gen * 0.35, 1.2, 3.2), phase: Math.random() * TAU });
    }

    // Advance every live tip one step; stroke the new segment onto the branch
    // layer. Tips wander, occasionally fork, and die by age / edge / cap.
    function grow() {
      const next = [];
      bctx.strokeStyle = colors.line;
      for (const t of tips) {
        const step = 9 + Math.random() * 5;
        t.a += (Math.random() - 0.5) * 0.9;          // wander → tangled, not straight
        const nx = t.x + Math.cos(t.a) * step;
        const ny = t.y + Math.sin(t.a) * step;

        bctx.globalAlpha = clamp(0.34 - t.gen * 0.03, 0.12, 0.34);
        bctx.lineWidth = Math.max(0.6, t.w);
        bctx.beginPath();
        bctx.moveTo(t.x, t.y);
        bctx.lineTo(nx, ny);
        bctx.stroke();
        segCount++;

        t.x = nx; t.y = ny; t.life -= 1; t.w *= 0.985;
        const dead = t.life <= 0 || segCount >= SEG_CAP ||
          nx < -40 || nx > W + 40 || ny < -40 || ny > H + 40;

        // Fork: spawn a child that veers off, and mark the junction.
        if (!dead && t.gen < 5 && next.length < TIP_CAP &&
            segCount < SEG_CAP && Math.random() < 0.16) {
          dropNode(nx, ny, t.gen);
          next.push({ x: nx, y: ny, a: t.a + (Math.random() < 0.5 ? -1 : 1) * (0.5 + Math.random() * 0.6),
            gen: t.gen + 1, life: t.life * (0.55 + Math.random() * 0.25), w: t.w * 0.78 });
        }

        if (dead) dropNode(nx, ny, t.gen);
        else next.push(t);
      }
      tips = next;
      if (!tips.length) growing = false;
    }

    function growAll() { while (tips.length) grow(); }   // reduced-motion path

    function fireSynapse(now) {
      if (nodes.length < 2) return;
      const a = nodes[(Math.random() * nodes.length) | 0];
      let b = null, best = 1e9;
      for (let i = 0; i < 14; i++) {                     // nearest of a few candidates
        const c = nodes[(Math.random() * nodes.length) | 0];
        if (c === a) continue;
        const d = (c.x - a.x) ** 2 + (c.y - a.y) ** 2;
        if (d < best && d > 400) { best = d; b = c; }
      }
      if (b && best < 260 * 260) synapses.push({ a, b, t0: now, dur: 900 + Math.random() * 700 });
    }

    function paint(now) {
      ctx.clearRect(0, 0, W, H);
      ctx.drawImage(branchLayer, 0, 0, W, H);

      // Nodes breathe; glow sprite scaled by radius + a gentle pulse.
      ctx.globalCompositeOperation = "lighter";
      for (const n of nodes) {
        const pulse = reduce ? 1 : 0.75 + 0.25 * Math.sin(now / 900 + n.phase);
        const r = n.r * (2.6 + pulse);
        ctx.globalAlpha = 0.5 * pulse;
        ctx.drawImage(glow, n.x - r, n.y - r, r * 2, r * 2);
      }

      // Synapses: a bright pulse rides the link a→b, fading in and out.
      for (let i = synapses.length - 1; i >= 0; i--) {
        const s = synapses[i];
        const p = (now - s.t0) / s.dur;
        if (p >= 1) { synapses.splice(i, 1); continue; }
        const fade = Math.sin(p * Math.PI);
        ctx.globalAlpha = 0.5 * fade;
        ctx.strokeStyle = colors.node;
        ctx.lineWidth = 1.1;
        ctx.beginPath();
        ctx.moveTo(s.a.x, s.a.y);
        ctx.lineTo(s.b.x, s.b.y);
        ctx.stroke();
        const px = s.a.x + (s.b.x - s.a.x) * p;
        const py = s.a.y + (s.b.y - s.a.y) * p;
        const r = 7;
        ctx.globalAlpha = 0.85 * fade;
        ctx.drawImage(glow, px - r, py - r, r * 2, r * 2);
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
    }

    function frame(now) {
      if (growing) { grow(); grow(); }                  // two steps/frame → brisk growth
      else if (now > fireAt) { fireSynapse(now); fireAt = now + 600 + Math.random() * 1400; }
      paint(now);
      raf = requestAnimationFrame(frame);
    }

    function build() {
      cancelAnimationFrame(raf);
      colors = readColors();
      glow = makeGlow(colors.node);
      size();
      seed();
      segCount = 0;
      if (reduce) { growAll(); paint(0); return; }
      raf = requestAnimationFrame(frame);
    }

    let resizeT = 0;
    window.addEventListener("resize", () => {
      clearTimeout(resizeT);
      resizeT = setTimeout(build, 220);
    });

    build();
  }

  function mountAll() {
    const c = document.getElementById("thought-field");
    if (c) field(c);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mountAll);
  else mountAll();
})();
