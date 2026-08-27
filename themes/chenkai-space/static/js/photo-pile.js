/* photo-pile.js — 首页 hero 的照片堆叠交互
 *
 * 状态：一叠随手乱放的照片（每张有固定的伪随机散落姿态）。
 * 鼠标进入区域：照片缓动展开成扇形，横向位置跟随指针偏移；
 * 靠近某张：轻微躲闪；点击：弹到最上层并轻跳一下；
 * 移出区域：收回成叠。触屏设备改为点按切换展开。
 */

(() => {
  const stage = document.getElementById("photo-pile");
  if (!stage) return;
  const cards = Array.from(stage.querySelectorAll(".pile-card"));
  const N = cards.length;
  if (!N) return;

  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const canHover = matchMedia("(hover: hover)").matches;

  // 每张卡的固有特征（确定性伪随机，刷新后姿态不变）
  const trait = cards.map((_, i) => {
    const r = (n) => {
      const x = Math.sin(i * 127.1 + n * 311.7) * 43758.5453;
      return x - Math.floor(x);
    };
    return {
      rotS: (r(1) - 0.5) * 24,       // 堆叠时的随机角度
      ox: (r(2) - 0.5) * 34,         // 堆叠时的水平散落
      oy: (r(3) - 0.5) * 30,         // 堆叠时的垂直散落
      arcJit: (r(4) - 0.5) * 18,     // 扇形弧线的高低错落
      speed: 6.5 + r(5) * 4.5,       // 缓动速度差 → 拖尾感
      sp: 0.7 + r(6) * 0.9,          // 呼吸漂浮频率
      ph: r(7) * Math.PI * 2,
    };
  });

  // 当前值 / 目标值
  const cur = cards.map(() => ({ x: 0, y: 0, r: 0, s: 1 }));
  let order = cards.map((_, i) => i);          // 从底到顶
  let openCur = 0, openTarget = 0;
  let px = -9999, py = -9999;                  // 指针相对 stage 中心的坐标
  let pop = new Float32Array(N);               // 点击弹跳冲量
  let rectW = 0;

  order.forEach((ci, zi) => { cards[ci].style.zIndex = zi + 1; });

  const measure = () => { rectW = stage.getBoundingClientRect().width; };
  measure();
  addEventListener("resize", measure);

  if (canHover) {
    stage.addEventListener("pointerenter", () => { openTarget = 1; });
    stage.addEventListener("pointerleave", () => { openTarget = 0; px = py = -9999; });
    stage.addEventListener("pointermove", (e) => {
      const r = stage.getBoundingClientRect();
      px = e.clientX - r.left - r.width / 2;
      py = e.clientY - r.top - r.height / 2;
    });
  } else {
    stage.addEventListener("pointerdown", () => {
      openTarget = openTarget ? 0 : 1;
    });
  }

  cards.forEach((el, i) => {
    el.addEventListener("click", () => {
      const k = order.indexOf(i);
      if (k === N - 1) return;
      order.splice(k, 1);
      order.push(i);
      order.forEach((c, z) => { cards[c].style.zIndex = z + 1; });
      pop[i] = 1;
    });
  });

  const apply = (i, t) => {
    const tr = trait[i];
    const u = N > 1 ? i / (N - 1) - 0.5 : 0;
    const e = openCur < 0.001 ? 0 : openCur * (2 - openCur);   // 展开量再缓一层

    // 目标位姿 = 堆叠姿态 与 扇形姿态 按 e 插值（整体左偏一点，给右侧留呼吸）
    const fanX = u * Math.min(rectW * 0.78, 340) - 14;
    const fanY = -(1 - Math.pow(Math.abs(u) * 2, 1.35)) * (58 + tr.arcJit);
    const fanR = u * 42;
    let tx = tr.ox * 0.7 + (fanX - tr.ox * 0.7) * e;
    let ty = tr.oy + (fanY - tr.oy) * e;
    let tr_ = tr.rotS + (fanR - tr.rotS) * e;
    let ts = 1 + e * 0.03;

    // 待机呼吸（展开时弱一点）
    if (!reduceMotion) ty += Math.sin(t * tr.sp + tr.ph) * 3.2 * (1 - 0.5 * e);

    // 指针靠近时轻微躲闪
    if (openCur > 0.15 && canHover) {
      const dx = tx - px, dy = ty - py;
      const d = Math.hypot(dx, dy);
      const reach = rectW * 0.34;
      if (d < reach && d > 0.01) {
        const f = (1 - d / reach) * (1 - d / reach) * 20;
        tx += (dx / d) * f;
        ty += (dy / d) * f;
        ts += f / 200;
      }
    }

    // 点击冲量的弹性衰减
    if (pop[i] > 0.005) {
      ts += pop[i] * 0.08;
      ty -= pop[i] * 10;
      pop[i] *= Math.exp(-0.09);
    } else pop[i] = 0;

    // 逐卡独立缓动 → 有机拖尾
    const k = 1 - Math.exp(-trait[i].speed * dt);
    const c = cur[i];
    c.x += (tx - c.x) * k;
    c.y += (ty - c.y) * k;
    c.r += (tr_ - c.r) * k;
    c.s += (ts - c.s) * k;

    cards[i].style.transform =
      `translate(calc(-50% + ${c.x.toFixed(2)}px), calc(-50% + ${c.y.toFixed(2)}px)) ` +
      `rotate(${c.r.toFixed(2)}deg) scale(${c.s.toFixed(3)})`;
  };

  let dt = 0.016;
  let last = performance.now();
  let rafId = null;
  let inView = true;

  const tick = (now) => {
    rafId = requestAnimationFrame(tick);
    dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (document.hidden || !inView) return;

    const t = now / 1000;
    openCur += (openTarget - openCur) * Math.min(1, dt * 3.4);
    if (Math.abs(openTarget - openCur) < 0.0004) openCur = openTarget;
    for (let i = 0; i < N; i++) apply(i, t);
  };

  const start = () => { last = performance.now(); rafId = requestAnimationFrame(tick); };
  const stop = () => { cancelAnimationFrame(rafId); rafId = null; };

  if (reduceMotion) {
    // 弱动效偏好：直接摆好静态半开形态，不做循环
    openCur = openTarget = 0.42;
    measure();
    const savedDt = dt;
    dt = 1;
    for (let i = 0; i < N; i++) apply(i, 0);
    dt = savedDt;
  } else {
    new IntersectionObserver(([en]) => {
      inView = en.isIntersecting;
      if (inView && !rafId) start();
      else if (!inView && rafId) stop();
    }).observe(stage);
    start();
  }
})();
