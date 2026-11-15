(function () {
  const $ = (id) => document.getElementById(id);
  const URL_KEY = "music_worker_url";
  const PWD_KEY = "music_admin_pwd";
  const PWD_HOLD_KEY = "music_admin_pwd_hold";
  const DEFAULT_WORKER = "https://music-admin.shenck.workers.dev";
  const MAX_PICS = 9;
  const PIC_EDGE = 1600;

  const statusEl = $("write-status");
  const flashEl = $("write-flash");
  const picsRow = $("write-pics");
  const picsInput = $("pics-input");
  const btnPics = $("btn-pics");
  const btnAdd = $("btn-th-add");

  const pics = []; // { url } — 已上传到 R2 的图片
  let uploading = 0;

  function setStatus(text, ok) {
    statusEl.textContent = text;
    statusEl.classList.toggle("ok", !!ok);
  }

  function flash(msg, kind) {
    flashEl.hidden = false;
    flashEl.textContent = msg;
    flashEl.classList.toggle("is-error", kind === "error");
  }

  function workerUrl() { return ($("worker-url").value || "").trim().replace(/\/+$/, ""); }
  function password() { return ($("admin-pwd").value || "").trim(); }

  (function restore() {
    $("worker-url").value = localStorage.getItem(URL_KEY) || DEFAULT_WORKER;
    // Default to remembering the password on this phone, unless the user turned it off.
    $("write-remember").checked = localStorage.getItem(PWD_HOLD_KEY) !== "0";
    const saved = localStorage.getItem(PWD_KEY) || sessionStorage.getItem(PWD_KEY);
    if (saved && $("write-remember").checked) $("admin-pwd").value = saved;
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

  function rememberPassword() {
    localStorage.setItem(URL_KEY, workerUrl());
    sessionStorage.setItem(PWD_KEY, password());
    if ($("write-remember").checked) {
      localStorage.setItem(PWD_KEY, password());
      localStorage.setItem(PWD_HOLD_KEY, "1");
    } else {
      localStorage.removeItem(PWD_KEY);
      localStorage.setItem(PWD_HOLD_KEY, "0");
    }
  }

  async function connect() {
    try {
      setStatus("连接中…", false);
      await api("/api/login", "POST", {});
      rememberPassword();
      setStatus("已连接", true);
      $("write-gate").hidden = true;
      $("write-form").hidden = false;
      $("thought-list").hidden = false;
      flash("可以开始写了。");
      reloadThoughts();
      $("th-body").focus();
    } catch (e) {
      setStatus("未连接", false);
      flash(e.message, "error");
    }
  }

  function renderPics() {
    picsRow.innerHTML = "";
    pics.forEach((p, i) => {
      const tile = document.createElement("span");
      tile.className = "write-pic";
      const img = document.createElement("img");
      img.src = p.url;
      img.alt = "";
      img.loading = "lazy";
      const del = document.createElement("button");
      del.type = "button";
      del.className = "write-pic-del";
      del.textContent = "×";
      del.setAttribute("aria-label", "删除这张图片");
      del.addEventListener("click", () => {
        pics.splice(i, 1);
        renderPics();
      });
      tile.append(img, del);
      picsRow.appendChild(tile);
    });
    btnPics.hidden = pics.length >= MAX_PICS;
  }

  function setUploadingUI() {
    btnPics.disabled = uploading > 0;
    btnPics.textContent = uploading > 0 ? "上传中 " + uploading : "＋ 添加图片";
    btnAdd.disabled = uploading > 0;
  }

  function compressImage(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        const scale = Math.min(1, PIC_EDGE / Math.max(img.naturalWidth, img.naturalHeight));
        const w = Math.max(1, Math.round(img.naturalWidth * scale));
        const h = Math.max(1, Math.round(img.naturalHeight * scale));
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        canvas.getContext("2d").drawImage(img, 0, 0, w, h);
        canvas.toBlob(
          (blob) => (blob ? resolve(blob) : reject(new Error("压缩失败"))),
          "image/jpeg",
          0.85,
        );
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("图片读取失败"));
      };
      img.src = url;
    });
  }

  async function uploadImage(blob) {
    const res = await fetch(workerUrl() + "/api/life-upload", {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + password(),
        "Content-Type": blob.type || "image/jpeg",
      },
      body: blob,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || ("HTTP " + res.status));
    return data.url;
  }

  async function handleFiles(files) {
    const list = Array.from(files || []).filter((f) => f.type.startsWith("image/"));
    if (!list.length) return;
    const room = MAX_PICS - pics.length;
    if (room <= 0) {
      flash("最多带 9 张图片。", "error");
      return;
    }
    uploading = Math.min(list.length, room);
    setUploadingUI();
    const take = list.slice(0, room);
    for (const file of take) {
      try {
        const blob = await compressImage(file);
        pics.push({ url: await uploadImage(blob) });
      } catch (e) {
        flash("有一张图片没传上去：" + e.message, "error");
      } finally {
        uploading -= 1;
        setUploadingUI();
        renderPics();
      }
    }
  }

  async function addThought(ev) {
    if (ev) ev.preventDefault();
    if (uploading > 0) {
      flash("图片还在上传，等一下。", "error");
      return;
    }
    const title = ($("th-title").value || "").trim();
    const body = ($("th-body").value || "").trim();
    if (!body) { flash("正文必填。", "error"); return; }
    const btn = $("btn-th-add");
    btn.disabled = true;
    try {
      flash("正在发布…");
      const { posts } = await api("/api/thoughts", "POST", {
        post: {
          type: title ? "long" : "short",
          title,
          body,
          images: pics.map((p) => p.url),
          source: "admin",
          xUrl: "",
        },
      });
      $("th-title").value = "";
      $("th-body").value = "";
      pics.length = 0;
      renderPics();
      flash("已发布，大约 1 分钟后会上线。");
      renderThoughts(posts);
      $("th-body").focus();
    } catch (e) {
      flash("发布失败：" + e.message, "error");
    } finally {
      btn.disabled = false;
    }
  }

  async function reloadThoughts() {
    try {
      const { posts } = await api("/api/thoughts", "GET");
      renderThoughts(posts);
    } catch (e) {
      flash("加载想法失败：" + e.message, "error");
    }
  }

  function renderThoughts(posts) {
    const list = $("thought-list");
    list.innerHTML = "";
    if (!posts || !posts.length) {
      list.innerHTML = '<li class="admin-muted">还没有想法。</li>';
      return;
    }
    posts.slice(0, 8).forEach((p) => {
      const li = document.createElement("li");
      li.className = "admin-list-item";
      const date = (p.date || "").slice(0, 10);
      const picTag = (p.images && p.images.length) ? "  🖼" + p.images.length : "";
      const snippet = p.title || (p.body || "").replace(/\s+/g, " ").slice(0, 40);
      const meta = document.createElement("span");
      meta.textContent = snippet + picTag + "  " + date;
      li.appendChild(meta);
      list.appendChild(li);
    });
  }

  $("btn-connect").addEventListener("click", connect);
  $("admin-pwd").addEventListener("keydown", (e) => {
    if (e.key === "Enter") connect();
  });
  $("write-form").addEventListener("submit", addThought);
  btnPics.addEventListener("click", () => picsInput.click());
  picsInput.addEventListener("change", () => {
    handleFiles(picsInput.files);
    picsInput.value = "";
  });

  // Auto-enter if a remembered password is already on this phone.
  if (password()) {
    connect();
  }
})();
