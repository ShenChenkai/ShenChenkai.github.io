(() => {
  const root = document.getElementById("bgm");
  if (!root) return;

  const toggle = root.querySelector(".bgm-toggle");
  const nowEl = root.querySelector(".bgm-now");
  const artistEl = root.querySelector(".bgm-artist");
  const coverEl = root.querySelector(".bgm-cover");
  const KEY = "taochin-bgm-on";
  const VOL_BGM = 0.16;
  const VOL_TRACK = 0.55;
  const FADE_MS = 800;

  const audio = new Audio();
  audio.preload = "auto";
  audio.volume = 0;

  let tracks = [];
  let bag = [];
  let enabled = localStorage.getItem(KEY) === "1";
  let mode = "idle"; // idle | bgm | track
  let current = null;
  let trackStop = null;
  let fadeToken = 0;
  let fadeFrame = 0;
  let switchToken = 0;
  let tailFade = false;
  let userPaused = false;

  function setNow(title, artist) {
    if (nowEl) nowEl.textContent = title || "轻声播放";
    if (artistEl) {
      artistEl.textContent = artist || "";
      artistEl.hidden = !artist;
    }
  }

  function thumb(url) {
    if (!url) return "";
    return String(url).replace(/\/\d+x\d+bb/, "/200x200bb");
  }

  function coverOf(item) {
    if (item && item.cover) return item.cover;
    if (!item || !item.preview) return "";
    const found = tracks.find((t) => t.preview === item.preview);
    return (found && found.cover) || "";
  }

  function setCover(url) {
    if (!coverEl) return;
    const src = thumb(url);
    if (!src) {
      coverEl.removeAttribute("src");
      coverEl.hidden = true;
      root.classList.remove("has-cover");
      return;
    }
    if (coverEl.getAttribute("src") === src && !coverEl.hidden) {
      root.classList.add("has-cover");
      return;
    }
    coverEl.onload = () => {
      coverEl.hidden = false;
      root.classList.add("has-cover");
    };
    coverEl.onerror = () => {
      coverEl.hidden = true;
      root.classList.remove("has-cover");
    };
    coverEl.src = src;
  }

  function paint() {
    const playing = mode !== "idle" && !audio.paused;
    toggle.setAttribute("aria-pressed", playing ? "true" : "false");
    let label = "轻声播放背景音乐";
    if (playing) label = "暂停";
    else if (mode !== "idle" && current) label = "继续播放";
    toggle.setAttribute("aria-label", label);
    root.classList.toggle("is-on", enabled || playing);
    root.classList.toggle("is-playing", playing);
  }

  function shuffle(list) {
    const a = list.slice();
    for (let i = a.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = a[i];
      a[i] = a[j];
      a[j] = t;
    }
    return a;
  }

  function nextFromBag(avoidSrc) {
    if (!tracks.length) return null;
    if (!bag.length) {
      bag = shuffle(tracks);
      if (bag.length > 1 && avoidSrc && bag[0].preview === avoidSrc) {
        bag.push(bag.shift());
      }
    }
    return bag.shift();
  }

  function finishTrack() {
    const cb = trackStop;
    trackStop = null;
    if (cb) cb();
  }

  function cancelFade() {
    fadeToken += 1;
    if (fadeFrame) {
      cancelAnimationFrame(fadeFrame);
      fadeFrame = 0;
    }
  }

  function fadeTo(to, ms) {
    cancelFade();
    const token = fadeToken;
    const from = audio.volume;
    const duration = Math.max(0, ms);
    if (duration === 0 || Math.abs(from - to) < 0.008) {
      audio.volume = to;
      return Promise.resolve();
    }
    const t0 = performance.now();
    return new Promise((resolve) => {
      function step(now) {
        if (token !== fadeToken) {
          resolve(false);
          return;
        }
        const t = Math.min(1, (now - t0) / duration);
        const ease = t < 0.5 ? 2 * t * t : 1 - ((-2 * t + 2) ** 2) / 2;
        audio.volume = from + (to - from) * ease;
        if (t < 1) {
          fadeFrame = requestAnimationFrame(step);
        } else {
          audio.volume = to;
          fadeFrame = 0;
          resolve(true);
        }
      }
      fadeFrame = requestAnimationFrame(step);
    });
  }

  function sameSrc(url) {
    if (!url || !audio.src) return false;
    try {
      return audio.src === new URL(url, location.href).href;
    } catch {
      return audio.src === url;
    }
  }

  async function fadeOutIfPlaying() {
    if (audio.paused || audio.volume <= 0.01) {
      audio.volume = 0;
      return true;
    }
    const ok = await fadeTo(0, FADE_MS);
    return ok;
  }

  async function playItem(item, asTrack) {
    if (!item || !item.preview) return;
    const token = ++switchToken;
    tailFade = true;
    if (!(await fadeOutIfPlaying()) || token !== switchToken) return;

    current = item;
    mode = asTrack ? "track" : "bgm";
    userPaused = false;
    audio.volume = 0;
    if (!sameSrc(item.preview)) audio.src = item.preview;
    setNow(item.title || "未命名", item.artist || "");
    setCover(coverOf(item));
    try {
      await audio.play();
    } catch {
      if (token !== switchToken) return;
      if (!asTrack) {
        mode = "idle";
        setNow("点一下页面开始");
        paint();
      }
      return;
    }
    if (token !== switchToken) return;
    tailFade = false;
    fadeTo(asTrack ? VOL_TRACK : VOL_BGM, FADE_MS);
    paint();
  }

  function playBgm(avoidSrc) {
    if (!enabled) return;
    const item = nextFromBag(avoidSrc);
    if (!item) return;
    playItem(item, false);
  }

  async function settleIdle() {
    const token = ++switchToken;
    tailFade = true;
    if (!(await fadeOutIfPlaying()) || token !== switchToken) return;
    audio.pause();
    mode = "idle";
    current = null;
    setNow("轻声播放");
    paint();
  }

  audio.addEventListener("timeupdate", () => {
    if (tailFade || mode === "idle" || audio.paused) return;
    const duration = audio.duration;
    if (!Number.isFinite(duration) || duration <= 0) return;
    const remain = duration - audio.currentTime;
    if (remain <= FADE_MS / 1000 + 0.04) {
      tailFade = true;
      fadeTo(0, Math.max(120, remain * 1000));
    }
  });

  audio.addEventListener("ended", () => {
    const ended = current && current.preview;
    audio.volume = 0;
    if (mode === "track") {
      finishTrack();
      if (enabled) playBgm(ended);
      else {
        mode = "idle";
        current = null;
        setNow("轻声播放");
        paint();
      }
      return;
    }
    if (enabled) playBgm(ended);
    else {
      mode = "idle";
      current = null;
      setNow("轻声播放");
      paint();
    }
  });

  audio.addEventListener("error", () => {
    if (mode === "track") {
      finishTrack();
      if (enabled) playBgm();
      return;
    }
    if (enabled) playBgm(current && current.preview);
  });

  async function resumeCurrent() {
    userPaused = false;
    const vol = mode === "track" ? VOL_TRACK : VOL_BGM;
    try {
      audio.volume = 0;
      await audio.play();
    } catch {
      paint();
      return;
    }
    fadeTo(vol, FADE_MS);
    paint();
  }

  function pauseCurrent() {
    userPaused = true;
    cancelFade();
    audio.pause();
    paint();
  }

  root.addEventListener("click", () => {
    if (mode !== "idle" && current && !audio.paused) {
      pauseCurrent();
      return;
    }
    if (mode !== "idle" && current && audio.paused) {
      resumeCurrent();
      return;
    }
    enabled = true;
    localStorage.setItem(KEY, "1");
    playBgm();
    paint();
  });

  window.TaoChnBgm = {
    playTrack(src, meta, onStop) {
      if (!src) return;
      if (mode === "track" && current && current.preview === src && !audio.paused) {
        finishTrack();
        if (enabled) playBgm(src);
        else settleIdle();
        return "paused";
      }
      finishTrack();
      trackStop = typeof onStop === "function" ? onStop : null;
      playItem({
        title: (meta && meta.title) || "",
        artist: (meta && meta.artist) || "",
        preview: src,
        cover: (meta && meta.cover) || "",
      }, true);
      return "playing";
    },
    stopTrack() {
      if (mode !== "track") return;
      finishTrack();
      if (enabled) playBgm(current && current.preview);
      else settleIdle();
    },
  };

  function samePage(url) {
    return url.pathname === location.pathname && url.search === location.search;
  }

  function shouldHijack(a, event) {
    if (!a || event.defaultPrevented || event.button !== 0) return false;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false;
    if (a.target && a.target !== "_self") return false;
    if (a.hasAttribute("download")) return false;
    const href = a.getAttribute("href");
    if (!href || href.startsWith("mailto:") || href.startsWith("tel:") || href.startsWith("javascript:")) return false;
    let url;
    try { url = new URL(a.href, location.href); } catch { return false; }
    if (url.origin !== location.origin) return false;
    if (samePage(url) && url.hash) return false;
    const path = url.pathname;
    if (path.includes("/admin/") || path.includes("/write/")) return false;
    if (/\.(json|xml|txt|zip|pdf|jpe?g|png|gif|webp|mp3|m4a)(\?|$)/i.test(path)) return false;
    return true;
  }

  let navigating = false;
  async function go(url, push) {
    if (navigating) return;
    navigating = true;
    try {
      const res = await fetch(url, { headers: { Accept: "text/html" } });
      if (!res.ok) throw new Error("bad status");
      const html = await res.text();
      const doc = new DOMParser().parseFromString(html, "text/html");
      const nextDesk = doc.querySelector(".desk");
      const desk = document.querySelector(".desk");
      if (!nextDesk || !desk) throw new Error("no desk");
      document.title = doc.title || document.title;
      document.body.className = doc.body.className;
      desk.replaceWith(nextDesk);
      if (push) history.pushState({ taochn: true }, "", url);
      const hash = new URL(url, location.href).hash;
      if (hash) {
        const el = document.getElementById(decodeURIComponent(hash.slice(1)));
        if (el) el.scrollIntoView();
        else window.scrollTo(0, 0);
      } else {
        window.scrollTo(0, 0);
      }
      document.dispatchEvent(new Event("taochin:page"));
    } catch {
      location.href = url;
    } finally {
      navigating = false;
    }
  }

  document.addEventListener("click", (event) => {
    const a = event.target.closest("a[href]");
    if (!shouldHijack(a, event)) return;
    event.preventDefault();
    go(a.href, true);
  });

  window.addEventListener("popstate", () => {
    go(location.href, false);
  });

  function resumeIfNeeded() {
    if (userPaused) return;
    if (enabled && mode !== "track" && audio.paused && tracks.length) playBgm();
  }
  window.addEventListener("pointerdown", (event) => {
    if (event.target.closest && event.target.closest("#bgm")) return;
    resumeIfNeeded();
  }, { passive: true });
  window.addEventListener("keydown", resumeIfNeeded, { passive: true });

  paint();
  setNow(enabled ? "正在开启…" : "轻声播放");

  const listUrl = root.getAttribute("data-list");
  fetch(listUrl)
    .then((r) => {
      if (!r.ok) throw new Error("list");
      return r.json();
    })
    .then((data) => {
      tracks = Array.isArray(data) ? data.filter((t) => t && t.preview) : [];
      if (enabled) playBgm();
      else setNow("轻声播放");
    })
    .catch(() => {
      setNow("暂时没法播放");
    });
})();
