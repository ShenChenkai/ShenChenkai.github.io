/**
 * Music admin backend (Cloudflare Worker).
 *
 * Responsibilities:
 *  - Verify the admin password (stored as a Worker secret).
 *  - Resolve song metadata from Apple Music / QQ Music URLs (server-side, no CORS).
 *  - Read / write data/music.json in the GitHub repo (token stored as a secret).
 *
 * Secrets (set via `wrangler secret put` or the dashboard):
 *  - ADMIN_PASSWORD : the password you type in /admin/
 *  - GITHUB_TOKEN   : a fine-grained PAT with Contents: Read and write on the repo
 *
 * Vars (wrangler.toml [vars], optional — defaults below):
 *  - GH_OWNER, GH_REPO, GH_BRANCH, DATA_PATH
 */

const DEFAULTS = {
  GH_OWNER: "ShenChenkai",
  GH_REPO: "ShenChenkai.github.io",
  GH_BRANCH: "main",
  DATA_PATH: "data/music.json",
  SITE_PATH: "data/site.json",
};

// Known palette ids (must match the CSS in static/css/main.css).
const PALETTES = [
  "midnight", "stone", "dusk", "forest", "ink", "claude", "linear", "vercel", "raycast",
  "newjeans1", "newjeans2", "newjeans3", "newjeans4",
  "newjeans5", "newjeans6", "newjeans7", "newjeans8",
];

export default {
  async fetch(request, env) {
    const cors = corsHeaders(request);
    if (request.method === "OPTIONS") return new Response(null, { headers: cors });

    const url = new URL(request.url);
    try {
      if (url.pathname === "/api/login" && request.method === "POST") {
        requireAuth(request, env);
        return json({ ok: true }, 200, cors);
      }

      if (url.pathname === "/api/resolve" && request.method === "POST") {
        requireAuth(request, env);
        const { url: musicUrl } = await request.json();
        const album = await resolveMetadata(musicUrl);
        return json({ ok: true, album }, 200, cors);
      }

      if (url.pathname === "/api/albums") {
        requireAuth(request, env);
        const cfg = config(env);

        if (request.method === "GET") {
          const { data } = await ghGet(cfg, env, cfg.path);
          return json({ ok: true, albums: asAlbums(data) }, 200, cors);
        }
        if (request.method === "POST") {
          const { album } = await request.json();
          if (!album || !album.title) throw httpErr(400, "缺少标题");
          const { data, sha } = await ghGet(cfg, env, cfg.path);
          const albums = asAlbums(data);
          albums.push(normalizeAlbum(album));
          await ghPut(cfg, env, cfg.path, { albums }, sha, "Add album: " + album.title);
          return json({ ok: true, albums }, 200, cors);
        }
        if (request.method === "DELETE") {
          const { index } = await request.json();
          const { data, sha } = await ghGet(cfg, env, cfg.path);
          const albums = asAlbums(data);
          if (index < 0 || index >= albums.length) throw httpErr(400, "下标越界");
          const removed = albums.splice(index, 1)[0];
          await ghPut(cfg, env, cfg.path, { albums }, sha, "Remove album: " + (removed?.title || index));
          return json({ ok: true, albums }, 200, cors);
        }
      }

      if (url.pathname === "/api/config") {
        requireAuth(request, env);
        const cfg = config(env);

        if (request.method === "GET") {
          const { data } = await ghGet(cfg, env, cfg.sitePath);
          return json({ ok: true, config: normalizeConfig(data) }, 200, cors);
        }
        if (request.method === "POST") {
          const body = await request.json();
          const palette = String(body.defaultPalette || "");
          const mode = body.defaultMode === "light" ? "light" : "dark";
          if (!PALETTES.includes(palette)) throw httpErr(400, "未知配色: " + palette);
          const { data, sha } = await ghGet(cfg, env, cfg.sitePath);
          const next = { ...normalizeConfig(data), defaultPalette: palette, defaultMode: mode };
          await ghPut(cfg, env, cfg.sitePath, next, sha, "Set default theme: " + palette + "/" + mode);
          return json({ ok: true, config: next }, 200, cors);
        }
      }

      return json({ error: "Not found" }, 404, cors);
    } catch (e) {
      const status = e && e.status ? e.status : 500;
      return json({ error: String(e && e.message ? e.message : e) }, status, cors);
    }
  },
};

// ── auth & helpers ──────────────────────────────────────────
function config(env) {
  return {
    owner: env.GH_OWNER || DEFAULTS.GH_OWNER,
    repo: env.GH_REPO || DEFAULTS.GH_REPO,
    branch: env.GH_BRANCH || DEFAULTS.GH_BRANCH,
    path: env.DATA_PATH || DEFAULTS.DATA_PATH,
    sitePath: env.SITE_PATH || DEFAULTS.SITE_PATH,
  };
}

function asAlbums(data) {
  return data && Array.isArray(data.albums) ? data.albums : [];
}

function normalizeConfig(data) {
  const d = data || {};
  return {
    defaultPalette: d.defaultPalette || "midnight",
    defaultMode: d.defaultMode === "light" ? "light" : "dark",
  };
}

function requireAuth(request, env) {
  const auth = request.headers.get("Authorization") || "";
  const pwd = auth.replace(/^Bearer\s+/i, "");
  if (!env.ADMIN_PASSWORD) throw httpErr(500, "服务端未设置 ADMIN_PASSWORD");
  if (pwd !== env.ADMIN_PASSWORD) throw httpErr(401, "密码错误");
}

function httpErr(status, message) {
  const e = new Error(message);
  e.status = status;
  return e;
}

function corsHeaders(request) {
  const origin = request.headers.get("Origin") || "*";
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}

function json(obj, status, cors) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: { "Content-Type": "application/json; charset=utf-8", ...cors },
  });
}

function normalizeAlbum(a) {
  return {
    title: String(a.title || "").trim(),
    artist: String(a.artist || "").trim(),
    cover: String(a.cover || "").trim(),
    link: String(a.link || "").trim() || "#",
  };
}

// ── metadata resolution ─────────────────────────────────────
async function resolveMetadata(musicUrl) {
  if (!musicUrl) throw httpErr(400, "请提供链接");
  let host = "";
  try { host = new URL(musicUrl).hostname; } catch (e) { throw httpErr(400, "链接无效"); }

  if (host.includes("apple.com")) return resolveApple(musicUrl);
  if (host.includes("qq.com")) return resolveQQ(musicUrl);
  throw httpErr(400, "暂只支持 Apple Music / QQ Music 链接");
}

async function resolveApple(musicUrl) {
  const u = new URL(musicUrl);
  const cc = (u.pathname.match(/^\/([a-z]{2})\//) || [, "us"])[1];
  // Prefer the ?i= track id; else the trailing id in /song|album/<name>/<id>
  let id = u.searchParams.get("i");
  if (!id) {
    const m = u.pathname.match(/\/(?:song|album)\/[^/]+\/(\d+)/);
    if (m) id = m[1];
  }
  if (!id) throw httpErr(400, "无法从 Apple 链接解析 ID");

  const api = `https://itunes.apple.com/lookup?id=${id}&country=${cc}`;
  const res = await fetch(api, { headers: { "User-Agent": "Mozilla/5.0" } });
  if (!res.ok) throw httpErr(502, "iTunes API 请求失败 " + res.status);
  const data = await res.json();
  const r = (data.results || [])[0];
  if (!r) throw httpErr(404, "Apple 未找到该曲目");

  const cover = (r.artworkUrl100 || r.artworkUrl60 || "").replace(/\/\d+x\d+bb\./, "/600x600bb.");
  return {
    title: r.trackName || r.collectionName || "",
    artist: r.artistName || "",
    cover,
    link: r.trackViewUrl || r.collectionViewUrl || musicUrl,
    source: "apple",
  };
}

async function resolveQQ(musicUrl) {
  // 1) Resolve any short link to find the songmid.
  let mid = extractQQMid(musicUrl);
  if (!mid) {
    const res = await fetch(musicUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X)" },
    });
    mid = extractQQMid(res.url);
    if (!mid) {
      const body = await res.text();
      const m = body.match(/songmid['"=:\s]+([0-9A-Za-z]+)/);
      if (m) mid = m[1];
    }
  }
  if (!mid) throw httpErr(404, "无法从 QQ 链接解析 songmid");

  // 2) Pull song details.
  const api = `https://c.y.qq.com/v8/fcg-bin/fcg_play_single_song.fcg?songmid=${mid}&platform=yqq&format=json`;
  const res = await fetch(api, {
    headers: { "User-Agent": "Mozilla/5.0", "Referer": "https://y.qq.com/" },
  });
  if (!res.ok) throw httpErr(502, "QQ API 请求失败 " + res.status);
  const data = await res.json();
  const r = (data.data || [])[0];
  if (!r) throw httpErr(404, "QQ 未找到该曲目");

  const albumMid = r.album && r.album.mid ? r.album.mid : "";
  const cover = albumMid
    ? `https://y.qq.com/music/photo_new/T002R800x800M000${albumMid}.jpg`
    : "";
  return {
    title: r.name || r.title || "",
    artist: (r.singer || []).map((s) => s.name).join(", "),
    cover,
    link: musicUrl,
    source: "qq",
  };
}

function extractQQMid(u) {
  if (!u) return "";
  try {
    const parsed = new URL(u);
    const q = parsed.searchParams.get("songmid");
    if (q) return q;
    const m = parsed.pathname.match(/songDetail\/([0-9A-Za-z]+)/);
    if (m) return m[1];
  } catch (e) { /* not a full URL */ }
  const m2 = String(u).match(/songmid=([0-9A-Za-z]+)/);
  return m2 ? m2[1] : "";
}

// ── GitHub data file I/O (generic over path) ────────────────
function ghUrl(cfg, path) {
  return `https://api.github.com/repos/${cfg.owner}/${cfg.repo}/contents/${path}`;
}

function ghHeaders(env) {
  return {
    "Authorization": "Bearer " + env.GITHUB_TOKEN,
    "Accept": "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "chenkai-music-admin",
  };
}

async function ghGet(cfg, env, path) {
  if (!env.GITHUB_TOKEN) throw httpErr(500, "服务端未设置 GITHUB_TOKEN");
  const res = await fetch(ghUrl(cfg, path) + "?ref=" + encodeURIComponent(cfg.branch), {
    headers: ghHeaders(env),
  });
  if (res.status === 404) return { data: {}, sha: null }; // file not created yet
  if (!res.ok) throw httpErr(502, "读取 GitHub 文件失败 " + res.status);
  const file = await res.json();
  let data;
  try { data = JSON.parse(b64decode(file.content)); }
  catch (e) { data = {}; }
  return { data, sha: file.sha };
}

async function ghPut(cfg, env, path, data, sha, message) {
  const body = {
    message,
    content: b64encode(JSON.stringify(data, null, 2) + "\n"),
    branch: cfg.branch,
  };
  if (sha) body.sha = sha; // omit to create a new file
  const res = await fetch(ghUrl(cfg, path), {
    method: "PUT",
    headers: { ...ghHeaders(env), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const t = await res.text();
    throw httpErr(502, "提交 GitHub 失败 " + res.status + " " + t.slice(0, 160));
  }
  return res.json();
}

// ── unicode-safe base64 ─────────────────────────────────────
function b64encode(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = "";
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin);
}
function b64decode(b64) {
  const bin = atob(String(b64).replace(/\s/g, ""));
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}
