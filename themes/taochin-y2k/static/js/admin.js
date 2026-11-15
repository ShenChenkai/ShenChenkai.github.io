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

  async function connect() {
    try {
      $("conn-status").textContent = "连接中…";
      await api("/api/login", "POST", {});
      localStorage.setItem(URL_KEY, workerUrl());
      sessionStorage.setItem(PWD_KEY, password());
      $("conn-status").textContent = "已连接";
      $("conn-status").classList.add("ok");
      $("admin-work").hidden = false;
      log("连接成功。");
      reload();
      reloadThoughts();
    } catch (e) {
      $("conn-status").textContent = e.message;
      $("conn-status").classList.remove("ok");
      log(e.message, "error");
    }
  }

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
    if (c) { box.style.backgroundImage = "url('" + c.replace(/'/g, "\\'") + "')"; box.classList.add("has-img"); }
    else { box.style.backgroundImage = ""; box.classList.remove("has-img"); }
  }

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
      log("已添加，大约 1 分钟后上线。");
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
    if (!albums || !albums.length) { list.innerHTML = '<li class="admin-muted">还没有专辑。</li>'; return; }
    albums.forEach((a, i) => {
      const li = document.createElement("li");
      li.className = "admin-list-item";
      const meta = document.createElement("span");
      meta.textContent = a.title + (a.artist ? " — " + a.artist : "");
      const del = document.createElement("button");
      del.className = "admin-btn-ghost admin-btn-small";
      del.type = "button";
      del.textContent = "删除";
      del.addEventListener("click", () => deleteAlbum(i, a.title));
      li.appendChild(meta);
      li.appendChild(del);
      list.appendChild(li);
    });
  }


  async function fetchTweetText() {
    const xUrl = ($("th-xurl").value || "").trim();
    if (!xUrl) { log("请先粘贴 X 链接。", "error"); return; }
    try {
      log("抓取 X 正文：" + xUrl);
      const r = await api("/api/x-fetch", "POST", { url: xUrl });
      if (r.text) $("th-body").value = r.text;
      $("th-xurl").value = r.xUrl || xUrl;
      const reply = r.replies && r.replies.length ? "，回复 " + r.replies.length + " 条" : "（回复未获取到）";
      log("抓取成功" + (r.author ? "（@" + r.author + "）" : "") + reply + "。");
    } catch (e) {
      log("抓取失败：" + e.message, "error");
    }
  }

  async function addThought() {
    const title = ($("th-title").value || "").trim();
    const xUrl = ($("th-xurl").value || "").trim();
    const post = {
      // Worker still stores title only when type is "long"; this is not shown in the UI.
      type: title ? "long" : "short",
      title,
      body: ($("th-body").value || "").trim(),
      source: xUrl ? "x" : "admin",
      xUrl,
    };
    if (!post.body) { log("正文必填。", "error"); return; }
    try {
      log("发布想法…");
      const { posts } = await api("/api/thoughts", "POST", { post });
      log("已发布，大约 1 分钟后上线。");
      ["th-title", "th-body", "th-xurl"].forEach((id) => ($(id).value = ""));
      renderThoughts(posts);
    } catch (e) {
      log("发布失败：" + e.message, "error");
    }
  }

  async function reloadThoughts() {
    try {
      const { posts } = await api("/api/thoughts", "GET");
      renderThoughts(posts);
      log("已加载 " + posts.length + " 条想法。");
    } catch (e) {
      log("加载想法失败：" + e.message, "error");
    }
  }

  async function deleteThought(id, label) {
    if (!confirm("删除「" + label + "」？")) return;
    try {
      const { posts } = await api("/api/thoughts", "DELETE", { id });
      log("已删除想法。");
      renderThoughts(posts);
    } catch (e) {
      log("删除失败：" + e.message, "error");
    }
  }

  function renderThoughts(posts) {
    const list = $("thought-list");
    list.innerHTML = "";
    if (!posts || !posts.length) { list.innerHTML = '<li class="admin-muted">还没有想法。</li>'; return; }
    posts.forEach((p) => {
      const li = document.createElement("li");
      li.className = "admin-list-item";
      const date = (p.date || "").slice(0, 10);
      const snippet = p.title || (p.body || "").replace(/\s+/g, " ").slice(0, 40);
      const meta = document.createElement("span");
      meta.textContent = snippet + (p.source === "x" ? " · X" : "") + "  " + date;
      const del = document.createElement("button");
      del.className = "admin-btn-ghost admin-btn-small";
      del.type = "button";
      del.textContent = "删除";
      del.addEventListener("click", () => deleteThought(p.id, snippet));
      li.appendChild(meta);
      li.appendChild(del);
      list.appendChild(li);
    });
  }

  async function reloadGuestbook() {
    try {
      const { messages } = await api("/api/guestbook", "GET");
      renderGuestbook(messages);
      log("已加载 " + messages.length + " 条留言。");
    } catch (e) {
      log("加载留言失败：" + e.message, "error");
    }
  }

  async function deleteGuestbookEntry(id, label) {
    if (!confirm("删除留言「" + label + "」？")) return;
    try {
      const { messages } = await api("/api/guestbook", "DELETE", { id });
      renderGuestbook(messages);
      log("已删除留言，约 1 分钟后从页面上消失。");
    } catch (e) {
      log("删除失败：" + e.message, "error");
    }
  }

  function renderGuestbook(messages) {
    const list = $("gb-list");
    list.innerHTML = "";
    if (!messages || !messages.length) { list.innerHTML = '<li class="admin-muted">还没有留言。</li>'; return; }
    messages.forEach((m) => {
      const li = document.createElement("li");
      li.className = "admin-list-item";
      const date = (m.at || "").slice(0, 16).replace("T", " ");
      const snippet = (m.body || "").replace(/\s+/g, " ").slice(0, 30);
      const meta = document.createElement("span");
      meta.textContent = (m.name || "匿名") + "：" + snippet + "  " + date;
      const del = document.createElement("button");
      del.className = "admin-btn-ghost admin-btn-small";
      del.type = "button";
      del.textContent = "删除";
      del.addEventListener("click", () => deleteGuestbookEntry(m.id, snippet));
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
  $("btn-th-fetch").addEventListener("click", fetchTweetText);
  $("btn-th-add").addEventListener("click", addThought);
  $("btn-th-reload").addEventListener("click", reloadThoughts);
  $("btn-gb-reload").addEventListener("click", reloadGuestbook);
})();


(function () {
  const $ = (id) => document.getElementById(id);
  const ABOUT_API = "http://127.0.0.1:1316";
  const EDU_FIELDS = ["org", "detail", "when"];
  const PROJECT_FIELDS = ["author", "title", "subtitle", "source", "when", "url", "note"];
  const PAPER_FIELDS = ["author", "title", "source", "when", "url"];
  const LABELS = {
    org: "学校 / 机构",
    detail: "说明（学院、学位等）",
    when: "时间",
    author: "作者",
    title: "标题",
    subtitle: "副标题",
    source: "来源",
    url: "链接",
    note: "备注",
  };
  const KINDS = {
    edu: { fields: EDU_FIELDS, label: "经历", box: "about-edu" },
    project: { fields: PROJECT_FIELDS, label: "项目", box: "about-projects" },
    paper: { fields: PAPER_FIELDS, label: "论文", box: "about-papers" },
  };

  function log(msg, kind) {
    const logEl = $("admin-log");
    if (!logEl) return;
    const t = new Date().toLocaleTimeString();
    logEl.textContent += "[" + t + "] " + (kind ? kind.toUpperCase() + ": " : "") + msg + "\n";
    logEl.scrollTop = logEl.scrollHeight;
  }

  function setStatus(text, ok) {
    const el = $("about-status");
    if (!el) return;
    el.textContent = text;
    el.classList.toggle("ok", !!ok);
  }

  async function aboutApi(path, method, payload) {
    const res = await fetch(ABOUT_API + path, {
      method: method || "GET",
      headers: { "Content-Type": "application/json" },
      body: payload ? JSON.stringify(payload) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || ("HTTP " + res.status));
    return data;
  }

  function relabel(box, kind) {
    const meta = KINDS[kind];
    Array.from(box.children).forEach((item, i) => {
      const title = item.querySelector(".admin-repeat-head strong");
      if (title) title.textContent = meta.label + " " + (i + 1);
    });
  }

  function addItem(kind, data) {
    const meta = KINDS[kind];
    const box = $(meta.box);
    const wrap = document.createElement("div");
    wrap.className = "admin-repeat-item";
    wrap.dataset.kind = kind;

    const head = document.createElement("div");
    head.className = "admin-repeat-head";
    const title = document.createElement("strong");
    const del = document.createElement("button");
    del.type = "button";
    del.className = "admin-btn-ghost admin-btn-small";
    del.textContent = "删除";
    del.addEventListener("click", () => {
      wrap.remove();
      relabel(box, kind);
    });
    head.append(title, del);

    const grid = document.createElement("div");
    grid.className = "admin-repeat-grid";
    meta.fields.forEach((name) => {
      const label = document.createElement("label");
      label.className = "admin-field";
      if (name === "title" || name === "subtitle" || name === "url" || name === "note" || name === "org") {
        label.classList.add("admin-field-span");
      }
      const span = document.createElement("span");
      span.textContent = LABELS[name] || name;
      const input = document.createElement("input");
      input.type = name === "url" ? "url" : "text";
      input.dataset.field = name;
      input.value = (data && data[name]) || "";
      label.append(span, input);
      grid.append(label);
    });

    wrap.append(head, grid);
    box.append(wrap);
    relabel(box, kind);
  }

  function fillList(kind, rows) {
    const box = $(KINDS[kind].box);
    box.innerHTML = "";
    (rows && rows.length ? rows : [{}]).forEach((row) => addItem(kind, row));
  }

  function collectList(kind) {
    const meta = KINDS[kind];
    return Array.from($(meta.box).querySelectorAll(".admin-repeat-item")).map((item) => {
      const row = {};
      meta.fields.forEach((f) => {
        row[f] = (item.querySelector('[data-field="' + f + '"]')?.value || "").trim();
      });
      return row;
    }).filter((row) => meta.fields.some((f) => row[f]));
  }

  function fillForm(about) {
    $("ab-name-en").value = about.name_en || "";
    $("ab-name-zh").value = about.name_zh || "";
    $("ab-email").value = about.email || "";
    $("ab-email-alt").value = about.email_alt || "";
    $("ab-loc-zh").value = about.location_zh || "";
    $("ab-loc-en").value = about.location_en || "";
    $("ab-portrait").value = about.portrait || "";
    $("ab-bio").value = about.bio || "";
    $("ab-sample").checked = !!about.sample;
    fillList("edu", about.education);
    fillList("project", about.projects);
    fillList("paper", about.papers);
  }

  function readForm() {
    return {
      name_en: ($("ab-name-en").value || "").trim(),
      name_zh: ($("ab-name-zh").value || "").trim(),
      email: ($("ab-email").value || "").trim(),
      email_alt: ($("ab-email-alt").value || "").trim(),
      location_zh: ($("ab-loc-zh").value || "").trim(),
      location_en: ($("ab-loc-en").value || "").trim(),
      portrait: ($("ab-portrait").value || "").trim(),
      bio: ($("ab-bio").value || "").replace(/\r\n/g, "\n"),
      sample: $("ab-sample").checked,
      education: collectList("edu"),
      projects: collectList("project"),
      papers: collectList("paper"),
    };
  }

  async function connectAbout() {
    setStatus("检测本地服务…", false);
    try {
      const data = await aboutApi("/api/about");
      fillForm(data.about || {});
      $("about-form").hidden = false;
      $("about-offline").hidden = true;
      setStatus("已连接本机预览", true);
      log("已加载本机主页字段。");
    } catch (e) {
      $("about-form").hidden = true;
      $("about-offline").hidden = false;
      setStatus("本地服务未开启", false);
      log("主页编辑服务连不上：请确认本机 1316 端口已打开。", "error");
    }
  }

  async function saveAbout(event) {
    event.preventDefault();
    const about = readForm();
    if (!about.name_en && !about.name_zh) {
      log("请至少填写一个名字。", "error");
      return;
    }
    try {
      await aboutApi("/api/about", "POST", { about });
      log("主页已保存到本机预览。刷新首页即可看到。");
      setStatus("已保存", true);
    } catch (e) {
      log("保存失败：" + e.message, "error");
    }
  }

  $("btn-ab-edu").addEventListener("click", () => addItem("edu", {}));
  $("btn-ab-project").addEventListener("click", () => addItem("project", {}));
  $("btn-ab-paper").addEventListener("click", () => addItem("paper", {}));
  $("btn-about-retry").addEventListener("click", connectAbout);
  $("about-form").addEventListener("submit", saveAbout);
  connectAbout();
})();
