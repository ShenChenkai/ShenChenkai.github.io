(function () {
  const $ = (id) => document.getElementById(id);
  const URL_KEY = "music_worker_url";
  const PWD_KEY = "music_admin_pwd";
  const PWD_HOLD_KEY = "music_admin_pwd_hold";
  const DEFAULT_WORKER = "https://music-admin.shenck.workers.dev";

  const statusEl = $("write-status");
  const flashEl = $("write-flash");

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

  async function addThought(ev) {
    if (ev) ev.preventDefault();
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
          source: "admin",
          xUrl: "",
        },
      });
      $("th-title").value = "";
      $("th-body").value = "";
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
      const snippet = p.title || (p.body || "").replace(/\s+/g, " ").slice(0, 40);
      const meta = document.createElement("span");
      meta.textContent = snippet + "  " + date;
      li.appendChild(meta);
      list.appendChild(li);
    });
  }

  $("btn-connect").addEventListener("click", connect);
  $("admin-pwd").addEventListener("keydown", (e) => {
    if (e.key === "Enter") connect();
  });
  $("write-form").addEventListener("submit", addThought);

  // Auto-enter if a remembered password is already on this phone.
  if (password()) {
    connect();
  }
})();
