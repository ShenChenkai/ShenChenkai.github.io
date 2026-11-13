/* photo-pile.js — 首页 hero 的照片堆叠交互
 *
 * 照片像随手摊在桌面上。指针是一支「手」：
 * 移动到哪，附近的照片就被轻轻推开让出空间，离开后归位；
 * 点击某张 = 把它拿起来举到屏幕中央细看（页面其余部分压暗），
 * 再点一次 / 点空白处 / 按 Esc 放回原位。
 * 触屏设备同样适用：拖动手指推开照片，点按拿起、再点放下。
 */

(() => {
  const stage = document.getElementById("photo-pile");
  if (!stage) return;
  const cards = Array.from(stage.querySelectorAll(".pile-card"));
  const N = cards.length;
  if (!N) return;

  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

  // 每张卡的固有特征（确定性伪随机，刷新后姿态不变）
  // gx/gy 是「摊在桌上」的归一化散布位：按网格分层再抖动，保证密集又不扎堆
  const cols = Math.max(2, Math.round(Math.sqrt(N * 1.5)));
  const rows = Math.ceil(N / cols);
  const trait = cards.map((_, i) => {
    const r = (n) => {
      const x = Math.sin(i * 127.1 + n * 311.7) * 43758.5453;
      return x - Math.floor(x);
    };
    return {
      rotS: (r(1) - 0.5) * 28,       // 桌面姿态随机角度 ±14°
      gx: ((i % cols) + 0.16 + r(2) * 0.68) / cols - 0.5,
      gy: (Math.floor(i / cols) + 0.2 + r(3) * 0.6) / rows - 0.5,
      speed: 6 + r(4) * 4.5,         // 缓动速度差 → 有机拖尾感
      sp: 0.7 + r(5) * 0.9,          // 呼吸漂浮频率
      ph: r(6) * Math.PI * 2,
    };
  });

  const cur = cards.map(() => ({ x: 0, y: 0, r: 0, s: 1 }));
  let px = -9999, py = -9999;                  // 指针相对 stage 中心的坐标
  let rectW = 0, rectH = 0;
  let halfHeights = [];                        // 每张卡半高，用于把卡片压回桌面范围
  let heldIdx = -1;                            // 正被拿起的那张；-1 无
  let returnIdx = -1;                          // 放回动画进行中的那张；-1 无
  let heldEl = null, heldReady = false;
  let hx = innerWidth / 2, hy = innerHeight * 0.42;   // 全局指针位置：拿起的照片跟随它漂移
  const hCur = { x: 0, y: 0, rx: 0, ry: 0 };          // 漂移/倾斜的当前值

  const measure = () => {
    const r = stage.getBoundingClientRect();
    rectW = r.width;
    rectH = r.height;
    halfHeights = cards.map((c) => c.offsetHeight / 2);
  };
  measure();
  addEventListener("resize", measure);

  // 按下指针时桌面「稳住」：否则照片在点击完成前就躲开，click 永远落空。
  // 触屏正好相反：只有手指接触时才推开照片。
  const isTouch = matchMedia("(hover: none)").matches;
  let pressing = false;
  stage.addEventListener("pointerdown", () => { pressing = true; });
  addEventListener("pointerup", () => { pressing = false; });
  addEventListener("pointercancel", () => { pressing = false; });

  stage.addEventListener("pointerleave", () => { px = py = -9999; });
  stage.addEventListener("pointermove", (e) => {
    const r = stage.getBoundingClientRect();
    px = e.clientX - r.left - r.width / 2;
    py = e.clientY - r.top - r.height / 2;
  });
  addEventListener("pointermove", (e) => { hx = e.clientX; hy = e.clientY; });

  /* ── 拿起 / 放下 ──────────────────────────────────────────── */

  let scrim = null;
  const ease = "cubic-bezier(.19, 1, .22, 1)";

  const makeScrim = () => {
    scrim = document.createElement("div");
    scrim.className = "pile-scrim";
    document.body.appendChild(scrim);
    requestAnimationFrame(() => scrim.classList.add("on"));
    scrim.addEventListener("click", putDown);
  };

  const pickUp = (i, el) => {
    if (heldIdx !== -1 || returnIdx !== -1) return;
    heldIdx = i;

    // 记录屏幕上的当前状态，把元素提升到 body 的 fixed 定位上做动画
    const bb = el.getBoundingClientRect();
    const memo = {
      left: bb.left, top: bb.top,
      width: bb.width, height: bb.height,
      rot: cur[i].r * 0.25,            // 拿起时照片基本转正，留一点歪
    };
    el._memo = memo;
    el.classList.add("pile-card--held");
    heldEl = el;
    // .hero-pile 的 transform 会劫持 position:fixed 的定位基准，
    // 先把元素挂到 body 上，fixed 才真正相对视口
    el._home = { parent: el.parentNode, next: el.nextSibling };
    document.body.appendChild(el);
    Object.assign(el.style, {
      position: "fixed",
      left: memo.left + "px",
      top: memo.top + "px",
      width: memo.width + "px",
      height: memo.height + "px",
      margin: "0",
      zIndex: "1200",
      transition: "none",
      transform: `rotate(${cur[i].r.toFixed(2)}deg)`,
    });

    makeScrim();

    const targetW = Math.min(innerWidth * 0.8, innerHeight * 0.68);
    const targetH = targetW;                       // 封面是正方形，拿起时保持 1:1

    requestAnimationFrame(() => {
      Object.assign(el.style, {
        transition: `left ${ease} .55s, top ${ease} .55s, width ${ease} .55s, height ${ease} .55s, transform ${ease} .55s`,
        left: (innerWidth - targetW) / 2 + "px",
        top: (innerHeight - targetH) / 2 + "px",
        width: targetW + "px",
        height: targetH + "px",
        transform: `rotate(${memo.rot.toFixed(2)}deg) scale(1)`,
        boxShadow: "0 26px 50px -18px rgba(26,24,20,.45), 0 80px 150px -40px rgba(26,24,20,.5)",
      });
    });
    // 入场动画结束后，transform 移交给逐帧视差
    setTimeout(() => {
      if (heldIdx !== i) return;
      el.style.transition = "box-shadow .4s ease";
      heldReady = true;
    }, 660);
    el.addEventListener("click", putDown);
  };

  const putDown = () => {
    if (heldIdx === -1) return;
    const i = heldIdx;
    const el = cards[i];
    const memo = el._memo;
    heldIdx = -1;
    heldReady = false;
    returnIdx = i;
    hCur.x = hCur.y = hCur.rx = hCur.ry = 0;

    el.removeEventListener("click", putDown);
    if (scrim) {
      const s = scrim;                      // 局部捕获，避免置 null 后闭包失效
      s.classList.remove("on");
      setTimeout(() => s.remove(), 250);
      scrim = null;
    }

    // 回到桌面上的原位，随后归还给普通定位与主循环
    Object.assign(el.style, {
      transition: `left ${ease} .5s, top ${ease} .5s, width ${ease} .5s, height ${ease} .5s, transform ${ease} .5s, box-shadow .35s ease`,
      left: memo.left + "px",
      top: memo.top + "px",
      width: memo.width + "px",
      height: memo.height + "px",
      boxShadow: "",
      transform: `rotate(${cur[i].r.toFixed(2)}deg)`,
    });
    setTimeout(() => {
      const home = el._home;
      if (home && home.parent) home.parent.insertBefore(el, home.next);
      el._home = null;
      el.classList.remove("pile-card--held");
      el.style.cssText = "";
      returnIdx = -1;
      heldEl = null;
    }, 600);
  };

  addEventListener("keydown", (e) => { if (e.key === "Escape") putDown(); });

  cards.forEach((el, i) => {
    el.addEventListener("click", () => pickUp(i, el));
  });

  /* ── 主循环 ──────────────────────────────────────────────── */

  // 拿起后的视差：屏幕中心为锚，指针位置换算成小位移向量＋细微倾角
  const applyHeld = (dt) => {
    if (!heldReady || reduceMotion || isTouch || !heldEl) return;
    const rot = heldEl._memo ? heldEl._memo.rot : 0;
    const nx = hx / innerWidth - 0.5;          // -0.5 ~ 0.5
    const ny = hy / innerHeight - 0.5;
    const k = 1 - Math.exp(-dt * 6);
    hCur.x += (nx * 46 - hCur.x) * k;
    hCur.y += (ny * 32 - hCur.y) * k;
    hCur.rx += (-ny * 6 - hCur.rx) * k;
    hCur.ry += (nx * 9 - hCur.ry) * k;
    heldEl.style.transform =
      `perspective(1000px) translate(${hCur.x.toFixed(2)}px, ${hCur.y.toFixed(2)}px) ` +
      `rotate(${rot.toFixed(2)}deg) rotateX(${hCur.rx.toFixed(2)}deg) rotateY(${hCur.ry.toFixed(2)}deg)`;
  };

  let dt = 0.016;
  let last = performance.now();
  let rafId = null;
  let inView = true;

  const apply = (i, t) => {
    if (i === heldIdx || i === returnIdx) return;   // 拿起/放回中不参与
    const tr = trait[i];

    // 目标：桌面上的家
    let tx = tr.gx * rectW;
    let ty = tr.gy * rectH;
    let tr_ = tr.rotS;
    let ts = 1;

    // 待机呼吸
    if (!reduceMotion) ty += Math.sin(t * tr.sp + tr.ph) * 3.4;

    // 「手拂过桌面」：靠近指针的照片被推开让出空间
    const repelOn = isTouch ? pressing : (px > -9000 && !pressing);
    if (repelOn) {
      const dx = tx - px, dy = ty - py;
      const d = Math.hypot(dx, dy);
      const reach = Math.min(rectW * 0.55, 310);
      if (d < reach && d > 0.01) {
        const k = 1 - d / reach;
        const f = k * k * (88 + 34 * k);       // 越近推得越远
        tx += (dx / d) * f;
        ty += (dy / d) * f;
        tr_ += (dx / d) * k * 7;               // 顺着推开方向微微偏头
        ts -= k * k * 0.05;                    // 略微压低一点
      }
    }

    // 上下不出桌面：卡片顶进 sticky 导航栏下面会破版（左右保持可溢出的散漫感）
    const halfH = halfHeights[i] || 0;
    ty = Math.min(Math.max(ty, -rectH / 2 + halfH), rectH / 2 - halfH);

    // 逐卡独立缓动 → 有机拖尾
    const k = 1 - Math.exp(-tr.speed * dt);
    const c = cur[i];
    c.x += (tx - c.x) * k;
    c.y += (ty - c.y) * k;
    c.r += (tr_ - c.r) * k;
    c.s += (ts - c.s) * k;

    cards[i].style.transform =
      `translate(calc(-50% + ${c.x.toFixed(2)}px), calc(-50% + ${c.y.toFixed(2)}px)) ` +
      `rotate(${c.r.toFixed(2)}deg) scale(${c.s.toFixed(3)})`;
  };

  const tick = (now) => {
    rafId = requestAnimationFrame(tick);
    dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (document.hidden || !inView) return;

    const t = now / 1000;
    for (let i = 0; i < N; i++) apply(i, t);
    if (heldIdx !== -1 && heldEl) applyHeld(dt);
  };

  const start = () => { last = performance.now(); rafId = requestAnimationFrame(tick); };
  const stop = () => { cancelAnimationFrame(rafId); rafId = null; };

  if (reduceMotion) {
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
