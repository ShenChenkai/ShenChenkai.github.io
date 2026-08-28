/* particle-title.js — hero 标题的粒子化
 *
 * 原理（借鉴 ascii-simulation-art-console 的「亮度 → 密度」思想，Canvas 2D 轻量版）：
 * 把 h1 的三行文字画到离屏画布 → 按网格采样字形像素 → 每个采样点成为一个粒子，
 * 弹簧回归到字形位置；指针靠近时被推开再弹回（与照片桌面的「手拂过」同款隐喻）。
 * 颜色每帧从 CSS 变量读取，明暗/配色切换自动生效。
 * prefers-reduced-motion 或无 JS 时保留普通文字排版（canvas 不启动）。
 */

(() => {
  const h1 = document.getElementById("hero-title");
  const canvas = document.getElementById("hero-particle-canvas");
  if (!h1 || !canvas) return;
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const spans = Array.from(h1.querySelectorAll(".display-l1, .display-lx, .display-l2"));
  if (!spans.length) return;

  const dpr = () => Math.min(2, window.devicePixelRatio || 1);
  let parts = [];            // {tx,ty,x,y,vx,vy,g,st,ph}
  let groups = [];           // 每帧从 CSS 变量读取的 [墨色, 强调色, 灰调]
  let W = 0, H = 0, fontSize = 0;
  let mx = -9999, my = -9999;
  let rafId = null, inView = true;

  const readColors = () => {
    const cs = getComputedStyle(document.documentElement);
    return [
      cs.getPropertyValue("--text").trim(),
      cs.getPropertyValue("--accent").trim(),
      cs.getPropertyValue("--muted").trim(),
    ];
  };

  const build = () => {
    const cs = getComputedStyle(spans[0]);
    fontSize = parseFloat(cs.fontSize);
    const lineH = parseFloat(cs.lineHeight) || fontSize * 1.18;

    // 若最长一行超出列宽，等比缩小字号（canvas 里没有自动换行）
    const probe = document.createElement("canvas").getContext("2d");
    const setFont = (px) => {
      probe.font = `${cs.fontWeight} ${px}px ${cs.fontFamily}`;
    };
    setFont(fontSize);
    let widest = 0;
    spans.forEach((s) => { widest = Math.max(widest, probe.measureText(s.textContent).width); });
    if (widest > 0 && widest > W * 0.98) fontSize *= (W * 0.96) / widest;

    W = Math.max(200, Math.round(h1.clientWidth));
    H = Math.round(lineH * spans.length);

    const off = document.createElement("canvas");
    off.width = W; off.height = H;
    const c = off.getContext("2d", { willReadFrequently: true });
    c.font = `${cs.fontWeight} ${fontSize}px ${cs.fontFamily}`;
    try { c.letterSpacing = cs.letterSpacing; } catch (e) {}
    c.textBaseline = "middle";
    spans.forEach((s, i) => c.fillText(s.textContent, 0, lineH * (i + 0.5)));

    const data = c.getImageData(0, 0, W, H).data;
    const step = Math.max(3, Math.round(fontSize / 16));
    parts = [];
    for (let y = 0; y < H; y += step) {
      for (let x = 0; x < W; x += step) {
        if (data[(y * W + x) * 4 + 3] > 140) {
          parts.push({
            tx: x, ty: y,
            x: W * (0.3 + Math.random() * 0.5),
            y: H * (0.5 + (Math.random() - 0.5) * 1.6),
            vx: 0, vy: 0,
            g: Math.min(2, Math.floor(y / lineH)), // 按行取色：墨 / 强调 / 灰
            st: 0.012 + Math.random() * 0.009,    // 弹簧刚度差 → 聚散拖尾
            ph: Math.random() * Math.PI * 2,
          });
        }
      }
    }

    canvas.width = W * dpr();
    canvas.height = H * dpr();
    canvas.style.width = W + "px";
    canvas.style.height = H + "px";
    h1.classList.add("display--particles");
  };

  h1.addEventListener("pointermove", (e) => {
    const r = canvas.getBoundingClientRect();
    mx = e.clientX - r.left;
    my = e.clientY - r.top;
  });
  h1.addEventListener("pointerleave", () => { mx = my = -9999; });

  const tick = (now) => {
    rafId = requestAnimationFrame(tick);
    if (document.hidden || !inView) return;
    const t = now / 1000;
    const dprv = dpr();
    groups = readColors();
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dprv, 0, 0, dprv, 0, 0);
    ctx.clearRect(0, 0, W, H);

    const reach = fontSize * 1.15;
    const dot = Math.max(1.6, fontSize / 34);

    for (let g = 0; g < 3; g++) {
      ctx.fillStyle = groups[g] || "#888";
      const d = g === 0 ? dot * 1.18 : dot;   // 首行墨点稍大，撑出层级
      for (let i = 0; i < parts.length; i++) {
        const p = parts[i];
        if (p.g !== g) continue;

        // 指针避让：靠近的粒子被推开，弹簧拉回
        if (mx > -9000) {
          const dx = p.x - mx, dy = p.y - my;
          const d = Math.hypot(dx, dy);
          if (d < reach && d > 0.01) {
            const f = (1 - d / reach) * 1.9;
            p.vx += (dx / d) * f;
            p.vy += (dy / d) * f;
          }
        }

        // 弹簧 + 阻尼 + 微呼吸
        p.vx += (p.tx - p.x) * p.st;
        p.vy += (p.ty - p.y) * p.st;
        p.vx *= 0.86; p.vy *= 0.86;
        p.x += p.vx;
        p.y += p.vy;

        const wob = Math.sin(t * 1.3 + p.ph) * 0.6;
        ctx.fillRect(p.x, p.y + wob, d, d);
      }
    }
  };

  build();

  // 列宽变化（视口缩放/换栏）时重建采样，粒子保留当前位置只换目标
  let ro = new ResizeObserver(() => {
    clearTimeout(ro._t);
    ro._t = setTimeout(build, 160);
  });
  ro.observe(h1);

  new IntersectionObserver(([en]) => {
    inView = en.isIntersecting;
    if (inView && !rafId) { rafId = requestAnimationFrame(tick); }
    else if (!inView && rafId) { cancelAnimationFrame(rafId); rafId = null; }
  }).observe(h1);

  rafId = requestAnimationFrame(tick);
})();
