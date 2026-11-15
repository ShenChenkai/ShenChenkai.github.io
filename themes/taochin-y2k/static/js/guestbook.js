(() => {
  // Same Worker convention as admin.js / write.js.
  const URL_KEY = "music_worker_url";
  const DEFAULT_WORKER = "https://music-admin.shenck.workers.dev";

  let form, list, errorEl, submitBtn;
  let current = []; // newest first

  const stamp = new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  function workerUrl() {
    let base = DEFAULT_WORKER;
    try { base = localStorage.getItem(URL_KEY) || DEFAULT_WORKER; } catch {}
    return String(base).replace(/\/+$/, "");
  }

  function entryNode(entry) {
    const article = document.createElement("article");
    article.className = "book-entry";
    const header = document.createElement("header");
    const name = document.createElement("strong");
    name.textContent = entry.name;
    const time = document.createElement("time");
    const at = new Date(entry.at);
    time.dateTime = entry.at;
    time.textContent = isNaN(at) ? "" : stamp.format(at);
    header.append(name, time);
    const body = document.createElement("p");
    body.textContent = entry.body;
    article.append(header, body);
    return article;
  }

  function render(entries) {
    list.querySelectorAll(".book-entry").forEach((el) => el.remove());
    const empty = list.querySelector("[data-guestbook-empty]");
    if (empty) empty.hidden = entries.length > 0;
    entries.forEach((entry) => list.append(entryNode(entry)));
  }

  // The page ships with a statically rendered list; parse it as the
  // starting state so the page still works when the Worker is unreachable.
  function readBaked() {
    const out = [];
    list.querySelectorAll(".book-entry").forEach((el) => {
      out.push({
        name: el.querySelector("header strong")?.textContent || "",
        at: el.querySelector("header time")?.getAttribute("datetime") || "",
        body: el.querySelector("p")?.textContent || "",
      });
    });
    return out;
  }

  function showError(text) {
    if (!errorEl) return;
    errorEl.textContent = text;
    errorEl.hidden = !text;
  }

  async function load() {
    try {
      const res = await fetch(workerUrl() + "/api/guestbook");
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !Array.isArray(data.messages)) return;
      current = data.messages;
      render(current);
    } catch {
      // Worker unreachable: keep the statically rendered list.
    }
  }

  async function submit(event) {
    event.preventDefault();
    const data = new FormData(form);
    const name = String(data.get("name") || "").trim();
    const body = String(data.get("body") || "").trim();
    const website = String(data.get("website") || "");
    if (!name || !body) { showError("昵称和留言都要写哦。"); return; }
    submitBtn.disabled = true;
    showError("");
    try {
      const res = await fetch(workerUrl() + "/api/guestbook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, body, website }),
      });
      const out = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(out.error || ("HTTP " + res.status));
      const item = out.message || { name, body, at: new Date().toISOString() };
      current = [item, ...current.filter((m) => m.id !== item.id)];
      render(current);
      form.reset();
    } catch (e) {
      showError("留言没有发出去：" + e.message);
    } finally {
      submitBtn.disabled = false;
    }
  }

  function init() {
    form = document.querySelector("[data-guestbook-form]");
    list = document.querySelector("[data-guestbook-list]");
    errorEl = document.querySelector("[data-guestbook-error]");
    submitBtn = form?.querySelector("[data-guestbook-submit]");
    if (!form || !list) return;
    if (list.dataset.live === "1") return; // already wired to this DOM
    list.dataset.live = "1";
    current = readBaked();
    render(current);
    form.addEventListener("submit", submit);
    load();
  }

  document.addEventListener("DOMContentLoaded", init);
  document.addEventListener("taochin:page", init);
  if (document.readyState !== "loading") init();
})();
