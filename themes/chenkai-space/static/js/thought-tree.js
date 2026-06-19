/**
 * Thought-tree generator. One renderer drives three places:
 *   · Lab gallery  — many <figure.spec> with sample content.
 *   · Admin preview — one <figure.spec> re-mounted on every control change.
 *   · Thoughts page — one <figure.spec data-real="1"> fed real posts via
 *                     window.__TREE_THOUGHTS__; tips link down to the feed.
 *
 * A tree is grown recursively: branches taper by generation (root thick →
 * tip thin), split asymmetrically, and lean — so it reads as a real tree,
 * not a symmetric fan. A subset of tips carry a preview card that blooms on
 * hover; the rest are decorative. Growth uses per-branch stroke self-drawing.
 *
 * Public: window.ThoughtTree.mount(specEl), window.ThoughtTree.mountAll().
 */
(function () {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const HALF_PI = Math.PI / 2;
  const SVGNS = "http://www.w3.org/2000/svg";

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Per-style growth character. Tuned for a 440×340 canvas.
  const STYLES = {
    ink:     { depth: 4, len: 94, width: 13, taper: 0.64, lenF: 0.74, spread: 0.66, curve: 0.55, wobble: 0.30, lean: 0.42, upBias: 0.05, minW: 1.4, children: (r) => (r() < 0.74 ? 2 : 1), cap: 60 },
    vine:    { depth: 5, len: 58, width: 4.5, taper: 0.94, lenF: 0.85, spread: 0.6, curve: 0.8, wobble: 0.38, lean: 0.12, upBias: 0.16, minW: 1.4, children: (r) => (r() < 0.4 ? 2 : 1), cap: 48 },
    crown:   { depth: 5, len: 84, width: 12.5, taper: 0.7, lenF: 0.76, spread: 0.52, curve: 0.34, wobble: 0.18, lean: 0.16, upBias: 0.08, minW: 1.4, children: (r, d) => (d < 2 ? (r() < 0.5 ? 3 : 2) : 2), cap: 130 },
    minimal: { depth: 3, len: 102, width: 6, taper: 0.6, lenF: 0.82, spread: 0.58, curve: 0.42, wobble: 0.2, lean: 0.18, upBias: 0.05, minW: 1.6, children: (r) => (r() < 0.6 ? 2 : 1), cap: 26 },
    cherry:  { depth: 5, len: 80, width: 11.5, taper: 0.68, lenF: 0.75, spread: 0.56, curve: 0.4, wobble: 0.22, lean: 0.2, upBias: 0.07, minW: 1.4, children: (r, d) => (d < 2 ? (r() < 0.55 ? 3 : 2) : 2), cap: 130 },
  };

  // Sample cards for lab/admin previews (POC, not real data).
  const SAMPLE = [
    { date: "2026 · 06", snip: "把 Essays 改成 Thoughts 之后，发观点轻松多了。" },
    { date: "2026 · 05", snip: "深夜调配色，claude 那套暖土赤陶意外耐看。" },
    { date: "2026 · 04", snip: "音乐墙的双排反向滚动，比静态网格更有呼吸感。" },
    { date: "2026 · 03", snip: "Music saves the world —— 越用越觉得这句对。" },
    { date: "2026 · 02", snip: "给个人主页加了后台，写东西的摩擦力小了一截。" },
    { date: "2026 · 01", snip: "先把骨架立住，叶子和花以后慢慢长。" },
  ];

  function buildTree(cfg, seed, W, H) {
    const rng = mulberry32(seed);
    const branches = [];
    const tips = [];

    function grow(x, y, angle, length, width, depth) {
      if (branches.length > cfg.cap) { tips.push({ x, y, depth }); return; }
      const steps = 5;
      const segLen = length / steps;
      const curveStep = ((rng() - 0.5) * cfg.curve) / steps;
      let a = angle, px = x, py = y;
      let d = `M${x.toFixed(1)},${y.toFixed(1)}`;
      for (let s = 0; s < steps; s++) {
        a += curveStep + (rng() - 0.5) * cfg.wobble * 0.3;
        px += Math.cos(a) * segLen;
        py -= Math.sin(a) * segLen;
        d += `L${px.toFixed(1)},${py.toFixed(1)}`;
      }
      branches.push({ d, width, depth });

      const childW = width * cfg.taper;
      if (depth >= cfg.depth || childW < cfg.minW) { tips.push({ x: px, y: py, depth }); return; }

      const n = cfg.children(rng, depth);
      for (let c = 0; c < n; c++) {
        let off;
        if (n === 1) off = (rng() - 0.5) * cfg.spread * 0.85;
        else off = (c / (n - 1) - 0.5) * 2 * cfg.spread * (0.6 + rng() * 0.6);
        let ca = a + off;
        ca += (HALF_PI - ca) * cfg.upBias;           // phototropic upward bias
        const cl = length * cfg.lenF * (0.8 + rng() * 0.4);
        grow(px, py, ca, cl, childW, depth + 1);
      }
    }

    grow(W / 2, H - 4, HALF_PI + (rng() - 0.5) * cfg.lean, cfg.len, cfg.width, 0);
    return { branches, tips };
  }

  function buildCard(item, side) {
    const card = document.createElement("div");
    card.className = `card card--${side}`;
    let html = `<time>${item.date}</time>`;
    if (item.title) html += `<strong>${item.title}</strong>`;
    html += `<p>${item.snip}</p>`;
    if (item.src === "x" && item.x) html += `<a class="card-src" href="${item.x}" target="_blank" rel="noopener">在 X 查看 ↗</a>`;
    else if (item.id) html += `<span class="card-more">读全文 ↓</span>`;
    card.innerHTML = html;
    return card;
  }

  function mount(spec) {
    const styleKey = spec.dataset.style || "ink";
    const cfg = STYLES[styleKey] || STYLES.ink;
    const seed = Number(spec.dataset.seed || 1);
    const icon = spec.dataset.icon || "dot";
    const noAnim = reduce || spec.dataset.anim === "off";
    const real = spec.dataset.real === "1";
    const items = real ? (window.__TREE_THOUGHTS__ || []) : SAMPLE;

    const svg = spec.querySelector("svg");
    const vb = svg.getAttribute("viewBox").split(/\s+/).map(Number);
    const W = vb[2], H = vb[3];
    const ink = svg.querySelector(".tree-ink");
    const tipLayer = spec.querySelector(".tips");
    ink.textContent = "";        // clear previous mount (admin re-render)
    tipLayer.textContent = "";

    const { branches, tips } = buildTree(cfg, seed, W, H);

    // Trunk-out draw order: by depth, then creation order.
    const ordered = branches.map((b, i) => ({ b, i })).sort((p, q) => p.b.depth - q.b.depth || p.i - q.i);
    ordered.forEach((item, order) => {
      const path = document.createElementNS(SVGNS, "path");
      path.setAttribute("d", item.b.d);
      path.setAttribute("stroke-width", item.b.width.toFixed(1));
      ink.appendChild(path);
      if (noAnim) return;
      const len = path.getTotalLength();
      if (!len) return;
      path.style.strokeDasharray = len;
      path.style.strokeDashoffset = len;
      path.animate(
        [{ strokeDashoffset: len }, { strokeDashoffset: 0 }],
        { duration: 560, delay: item.b.depth * 180 + order * 12, easing: "cubic-bezier(0.4,0,0.2,1)", fill: "forwards" }
      );
    });
    const maxDelay = noAnim ? 0 : cfg.depth * 180 + branches.length * 12;

    // Pick tips to carry cards: all real posts, or a spread for samples.
    const sorted = tips.slice().sort((a, b) => a.x - b.x);
    const want = real
      ? Math.min(items.length, sorted.length)
      : Math.min(items.length, Math.max(3, Math.round(sorted.length / 4)));
    const carry = [];
    for (let k = 0; k < want; k++) carry.push(sorted[Math.floor((k + 0.5) * sorted.length / want)]);
    const carrySet = new Set(carry);

    let cardIdx = 0;
    tips.forEach((t, i) => {
      const node = document.createElement("div");
      node.className = `tree-node tip--${icon}`;
      node.style.left = `${(t.x / W * 100).toFixed(2)}%`;
      node.style.top = `${(t.y / H * 100).toFixed(2)}%`;
      const blob = document.createElement("span");
      blob.className = "blob";
      node.appendChild(blob);

      if (carrySet.has(t) && items.length) {
        const item = items[cardIdx++ % items.length];
        const side = t.x < W * 0.33 ? "left" : t.x > W * 0.67 ? "right" : t.y < H * 0.3 ? "top" : "mid";
        node.appendChild(buildCard(item, side));
        node.classList.add("has-card");
        if (item.id) {
          node.addEventListener("click", () => {
            const target = document.getElementById("t-" + item.id);
            if (target) {
              target.scrollIntoView({ behavior: "smooth", block: "center" });
              target.classList.remove("flash"); void target.offsetWidth; target.classList.add("flash");
            }
          });
        }
      }

      tipLayer.appendChild(node);
      if (noAnim) { node.classList.add("grown"); return; }
      setTimeout(() => node.classList.add("grown"), maxDelay * (0.4 + 0.5 * (t.depth / cfg.depth)) + i * 8);
    });
  }

  function mountAll() { document.querySelectorAll(".spec").forEach(mount); }

  window.ThoughtTree = { mount, mountAll, STYLES };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mountAll);
  else mountAll();
})();
