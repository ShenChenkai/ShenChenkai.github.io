(function () {
  const $ = (id) => document.getElementById(id);
  const logEl = $("admin-log");
  const URL_KEY = "music_worker_url";
  const PWD_KEY = "music_admin_pwd";
  const DEFAULT_WORKER = "https://music-admin.shenck.workers.dev";

  function log(msg, kind) {
    const t = new Date().toLocaleTimeString();
    logEl.textContent += "[" + t + "] " + (kind ? kind.toUpperCase() + ": " : "") + msg + "\n";
    logEl.scrollTop = logEl.scrollHeight;
  }

  function workerUrl() { return ($("worker-url").value || "").trim().replace(/\/+$/, ""); }
  function password() { return ($("admin-pwd").value || "").trim(); }

  // Restore saved settings (URL in localStorage, password in sessionStorage).
  (function restore() {
    $("worker-url").value = localStorage.getItem(URL_KEY) || DEFAULT_WORKER;
    const p = sessionStorage.getItem(PWD_KEY);
    if (p) $("admin-pwd").value = p;
  })();

  async function api(path, method, payload) {
    const base = workerUrl();
    if (!base) throw new Error("请先填写 Worker 地址");
    const res = await fetch(base + path, {
      method: method || "GET",
      headers: {
        "Authorization": "Bearer " + password(),
        "Content-Type": "application/json",
      },
      body: payload ? JSON.stringify(payload) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || ("HTTP " + res.status));
    return data;
  }

  // ── connect ───────────────────────────────────────────────
  async function connect() {
    try {
      $("conn-status").textContent = "连接中…";
      await api("/api/login", "POST", {});
      localStorage.setItem(URL_KEY, workerUrl());
      sessionStorage.setItem(PWD_KEY, password());
      $("conn-status").textContent = "✅ 已连接";
      $("conn-status").classList.add("ok");
      $("box-add").hidden = false;
      $("box-theme").hidden = false;
      $("box-particles").hidden = false;
      $("box-list").hidden = false;
      log("连接成功。");
      loadConfig();
      reload();
    } catch (e) {
      $("conn-status").textContent = "❌ " + e.message;
      $("conn-status").classList.remove("ok");
      log(e.message, "error");
    }
  }

  // ── resolve metadata from a music URL ─────────────────────
  async function resolve() {
    const url = ($("f-url").value || "").trim();
    if (!url) { log("请粘贴音乐链接。", "error"); return; }
    try {
      log("识别中：" + url);
      const { album } = await api("/api/resolve", "POST", { url });
      $("f-title").value = album.title || "";
      $("f-artist").value = album.artist || "";
      $("f-cover").value = album.cover || "";
      $("f-link").value = album.link || url;
      updateCover();
      log("识别成功：" + album.title + " — " + album.artist + "（" + (album.source || "?") + "）");
    } catch (e) {
      log("识别失败：" + e.message, "error");
    }
  }

  function updateCover() {
    const c = ($("f-cover").value || "").trim();
    const box = $("cover-preview");
    if (c) { box.style.backgroundImage = "url('" + c + "')"; box.classList.add("has-img"); }
    else { box.style.backgroundImage = ""; box.classList.remove("has-img"); }
  }

  // ── theme default ─────────────────────────────────────────
  async function loadConfig() {
    try {
      const { config } = await api("/api/config", "GET");
      $("t-palette").value = config.defaultPalette;
      $("t-mode").value = config.defaultMode;
      updateThemePreview();
      $("cur-theme").textContent = config.defaultPalette + " · " + config.defaultMode;

      const p = config.particles || {};
      const defs = { gap: 16, dotOpacity: 0.28, jitter: 1, wavePeriod: 8, waveAngle: 72, waveOpacity: 0.6 };
      PKEYS.forEach((k) => { $("p-" + k).value = p[k] != null ? p[k] : defs[k]; });
      applyParticlePreview();
      startParticlePreview();
    } catch (e) {
      log("读取站点配置失败：" + e.message, "error");
    }
  }

  // ── particles ─────────────────────────────────────────────
  const PKEYS = ["gap", "dotOpacity", "jitter", "wavePeriod", "waveAngle", "waveOpacity"];
  let previewStarted = false;

  // Mount the live canvas preview once the box is visible. The field reads the
  // CSS vars set by applyParticlePreview() on every frame, so slider changes
  // and theme switches show up without re-instantiating.
  function startParticlePreview() {
    if (previewStarted || !window.ParticleField) return;
    const canvas = $("particle-preview-canvas");
    if (!canvas) return;
    window.ParticleField(canvas, $("particle-preview"));
    previewStarted = true;
  }

  function gatherParticles() {
    const p = {};
    PKEYS.forEach((k) => (p[k] = Number($("p-" + k).value)));
    return p;
  }

  function applyParticlePreview() {
    const p = gatherParticles();
    const el = $("particle-preview");
    el.style.setProperty("--dot-gap", p.gap + "px");
    el.style.setProperty("--dot-opacity", p.dotOpacity);
    el.style.setProperty("--jitter", p.jitter);
    el.style.setProperty("--wave-period", p.wavePeriod + "s");
    el.style.setProperty("--wave-angle", p.waveAngle + "deg");
    el.style.setProperty("--wave-opacity", p.waveOpacity);
    $("v-gap").textContent = p.gap + "px";
    $("v-dotOpacity").textContent = p.dotOpacity.toFixed(2);
    $("v-jitter").textContent = p.jitter.toFixed(1) + "×";
    $("v-wavePeriod").textContent = p.wavePeriod + "s";
    $("v-waveAngle").textContent = p.waveAngle + "°";
    $("v-waveOpacity").textContent = p.waveOpacity.toFixed(2);
  }

  async function saveParticles() {
    try {
      log("保存粒子设置…");
      await api("/api/config", "POST", {
        defaultPalette: $("t-palette").value,
        defaultMode: $("t-mode").value,
        particles: gatherParticles(),
      });
      log("✅ 粒子设置已保存，约 1 分钟后上线。");
    } catch (e) {
      log("保存失败：" + e.message, "error");
    }
  }

  function updateThemePreview() {
    const box = $("theme-preview");
    box.setAttribute("data-palette", $("t-palette").value);
    box.setAttribute("data-theme", $("t-mode").value);
  }

  async function saveTheme() {
    const defaultPalette = $("t-palette").value;
    const defaultMode = $("t-mode").value;
    try {
      log("保存默认主题：" + defaultPalette + " / " + defaultMode);
      const { config } = await api("/api/config", "POST", { defaultPalette, defaultMode });
      $("cur-theme").textContent = config.defaultPalette + " · " + config.defaultMode;
      log("✅ 已保存，约 1 分钟后上线。");
    } catch (e) {
      log("保存失败：" + e.message, "error");
    }
  }

  // ── add / list / delete ───────────────────────────────────
  async function addAlbum() {
    const album = {
      title: ($("f-title").value || "").trim(),
      artist: ($("f-artist").value || "").trim(),
      cover: ($("f-cover").value || "").trim(),
      link: ($("f-link").value || "").trim() || "#",
    };
    if (!album.title) { log("标题必填。", "error"); return; }
    try {
      log("提交中：" + album.title);
      const { albums } = await api("/api/albums", "POST", { album });
      log("✅ 已添加，约 1 分钟后上线。");
      ["f-url", "f-title", "f-artist", "f-cover", "f-link"].forEach((id) => ($(id).value = ""));
      updateCover();
      renderList(albums);
    } catch (e) {
      log("添加失败：" + e.message, "error");
    }
  }

  async function reload() {
    try {
      const { albums } = await api("/api/albums", "GET");
      renderList(albums);
      log("已加载 " + albums.length + " 张专辑。");
    } catch (e) {
      log("加载失败：" + e.message, "error");
    }
  }

  async function deleteAlbum(index, title) {
    if (!confirm("删除「" + title + "」？")) return;
    try {
      const { albums } = await api("/api/albums", "DELETE", { index });
      log("已删除：" + title);
      renderList(albums);
    } catch (e) {
      log("删除失败：" + e.message, "error");
    }
  }

  function renderList(albums) {
    const list = $("album-list");
    list.innerHTML = "";
    if (!albums || !albums.length) { list.innerHTML = '<li class="admin-muted">（空）</li>'; return; }
    albums.forEach((a, i) => {
      const li = document.createElement("li");
      li.className = "admin-list-item";
      const meta = document.createElement("span");
      meta.textContent = a.title + (a.artist ? " — " + a.artist : "");
      const del = document.createElement("button");
      del.className = "admin-btn ghost small";
      del.textContent = "删除";
      del.addEventListener("click", () => deleteAlbum(i, a.title));
      li.appendChild(meta);
      li.appendChild(del);
      list.appendChild(li);
    });
  }

  $("btn-connect").addEventListener("click", connect);
  $("btn-resolve").addEventListener("click", resolve);
  $("btn-add").addEventListener("click", addAlbum);
  $("btn-reload").addEventListener("click", reload);
  $("f-cover").addEventListener("input", updateCover);
  $("btn-save-theme").addEventListener("click", saveTheme);
  $("t-palette").addEventListener("change", updateThemePreview);
  $("t-mode").addEventListener("change", updateThemePreview);
  $("btn-save-particles").addEventListener("click", saveParticles);
  PKEYS.forEach((k) => $("p-" + k).addEventListener("input", applyParticlePreview));
})();
