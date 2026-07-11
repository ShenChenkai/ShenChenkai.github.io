# CLAUDE.md — 项目说明 & Agent 工作约定

> 本文件给后续 agent 快速上手用。**改动项目结构后，请同步更新下方「目录树」一节**（见〈Agent 约定〉第 1 条）。

## 一、项目是什么

Chenkai 的个人主页。**Hugo 静态站**，部署在 **GitHub Pages**（`https://ShenChenkai.github.io/`），仓库 `ShenChenkai/ShenChenkai.github.io`，分支 `main`。

附带一个 **Cloudflare Worker 后端**（`worker/`），为 `/admin/` 后台提供：密码登录、音乐链接元数据自动识别（Apple Music / QQ 音乐）、把内容提交回仓库的 `data/*.json` 与 `content/tech/*.md`、以及 Life 照片上传/存取（存 Cloudflare R2，绕过仓库）。

### 技术栈 & 部署链路
- **Hugo**（extended，本地 v0.162.1）+ 自建主题 `chenkai-space`。
- **CI**：push 到 `main` → `.github/workflows/hugo.yml` 自动构建并部署到 Pages（来源须设为 GitHub Actions）。
- **后台写数据链路**：`/admin/` 页面 → Cloudflare Worker（持密码 + GitHub Token，均为服务端 secret）→ commit `data/music.json` / `data/site.json` → 触发 CI 重建 → 约 1 分钟上线。
- **主题/配色/字体**：CSS 自定义属性（`--bg/--text/--accent`、`--font-body` 等）。配色按 `[data-palette]` + `[data-theme]` 切换（17 套：9 常规 + 8 NewJeans）；正文字体按 `[data-font]` 切换（无衬线/衬线/等宽，均用系统字体栈）。

## 二、目录树（改动后请同步维护）

```
.
├── CLAUDE.md                     # 本文件：项目说明 + agent 约定（含开源 skill）
├── hugo.toml                     # Hugo 配置：站点标题、菜单（Tech/Thoughts/Life/Music）
├── .github/workflows/hugo.yml    # CI：构建 Hugo 并部署到 GitHub Pages
├── .gitignore                    # 忽略 public/、resources/、.codegraph/、.mcp.json、.claude/、worker 产物等
├── index.html, style.css         # 旧的 "Coming soon" 脚手架（已被 Hugo 站点取代，残留无害）
│
├── archetypes/default.md         # hugo new 的内容模板
├── content/                      # 页面内容（front matter 指定 layout）
│   ├── music/index.md            #   /music/    音乐墙页（layout: music/single）
│   ├── thoughts/index.md         #   /thoughts/ 想法页（layout: thoughts/single）
│   ├── admin/index.md            #   /admin/    后台（不进菜单/sitemap；layout: admin/single）
│   ├── life/index.md             #   /life/     生活页（朋友圈式：文字+照片流；layout: life/single）
│   ├── test/index.md             #   /test/     配色测试页（layout: test/single）
│   └── tech/_index.md            #   /tech/     二级结构：分类(section) → 笔记(page)，如 content/tech/go/variables.md
│                                  #     每个分类一个 _index.md（标题=分类名）；文章可手写 .md，也可在 /admin/ 里增删改
│                                  #     —— 两条路径都写同一批文件，谁改了都以仓库最新为准；标题取各篇 front matter title
│
├── data/                         # Hugo 数据文件（站点读取 + 后台写入）
│   ├── music.json                #   专辑列表 {albums:[{title,artist,cover,link}]}——后台管理，勿手改
│   ├── thoughts.json             #   想法列表 {posts:[{id,type,date,title,body,source,xUrl}]}——后台管理
│   ├── life.json                 #   生活记录 {posts:[{id,date,text,images:[R2图片URL]}]}——后台管理（照片存 R2，这里只存 URL）
│   └── site.json                 #   站点配置 {defaultPalette,defaultMode,defaultFont,particles{...}}——后台管理
│
├── themes/chenkai-space/
│   ├── layouts/
│   │   ├── _default/
│   │   │   ├── baseof.html        # 全站骨架（<html><head><body>）；.RelPermalink 为 /admin/ 时给 <main> 加 site-main--admin（撑满宽度，不受 900px 限制）
│   │   │   ├── list.html          # 列表页模板
│   │   │   └── single.html        # 单页默认模板
│   │   ├── index.html             # 首页（hero + tagline）
│   │   ├── partials/
│   │   │   ├── head.html          # <head>：注入默认配色/字体（data-palette/data-theme/data-font）+ 粒子参数为 CSS 变量
│   │   │   ├── header.html        # 顶部导航 + Music 彩色入口块（手绘音符）
│   │   │   └── footer.html        # 页脚
│   │   ├── music/single.html      # 音乐墙：嵌入专辑 JSON + 引 music.js
│   │   ├── thoughts/single.html   # 想法页：想法倒序列表（长想法带标题 / 短碎念 / 从 X 抓取的帖子）
│   │   ├── life/single.html       # 生活页：朋友圈式卡片流（文字 + 照片网格：单图大图/多图九宫格 + 时间）
│   │   ├── admin/single.html      # 后台 UI：未连接时显示独立登录界面（admin-login）；连接后切到仪表盘（admin-shell）——
│   │   │                         #   侧栏固定贴最左边（专辑/想法/生活/Tech 笔记/外观(配色+字体)/粒子背景 + 断开连接），右侧对应管理面板
│   │   ├── test/single.html       # 配色卡片预览页
│   │   └── tech/                  # 技术文章 section（唯一以独立 markdown 文件存内容的 section，其余均单个 data/*.json）
│   │       ├── list.html          #   /tech/ 与 /tech/<分类>/ 共用：根用 .Sections 列分类，分类页用 .RegularPages 列笔记
│   │       │                      #     （非根页面才显示分类标题；.Kind=="page" 才显示日期），无内容时显示占位文案
│   │       └── single.html        #   /tech/<分类>/<slug>/  单篇文章：标题=该 md 的 front matter title，正文居中（.single-post）
│   └── static/
│       ├── css/main.css           # 全站样式：配色 tokens、布局、音乐墙、想法卡片、Life 照片流、粒子动效、Tech 文章排版、后台
│       └── js/
│           ├── theme.js           # 明暗/配色切换函数（初始值在 head.html 内联应用）
│           ├── music.js           # 渲染音乐墙：随机打乱、双排反向滚动、占位色块
│           └── admin.js           # 后台逻辑：调 Worker API（登录/识别/专辑/想法/X抓取/配置/Tech分类+笔记/Life发布+编辑=前端压缩+上传R2）
│
└── worker/                        # Cloudflare Worker 后端（独立部署，非 Hugo 一部分）
    ├── src/index.js               # Worker 主逻辑：鉴权、Apple/QQ 元数据解析、X 帖子抓取、想法增删、Tech 分类+笔记增删改
    │                              #   （写 content/tech/<分类>/_index.md 与 <分类>/<slug>.md）、Life 增删改（写 data/life.json）
    │                              #   、Life 照片上传存 R2（POST /api/life-upload）+ 公开读图（GET /img/<key>）、GitHub 读写
    ├── wrangler.toml              # Worker 配置（仓库/路径 vars + R2 binding LIFE_BUCKET=chenkai-life；secret 不在此）
    └── README.md                  # Worker 部署步骤（secret 设置、wrangler deploy）
```

## 三、Agent 工作约定（重要）

1. **同步目录树**：每次新增 / 删除 / 重命名文件，或显著改变某文件作用后，必须更新本文件〈二、目录树〉一节，保持准确。
2. **优先用 codegraph MCP**：本目录已配置 codegraph（见 `.mcp.json`）。探索代码、查符号/调用关系时优先用 `codegraph_*` 工具，**减少 token 消耗**，避免大面积 Read/Grep。
3. **可改的网页设计优先做进后台**：凡是日后可能想调整的视觉/内容参数（配色、粒子、专辑、文案等），优先设计成「存 `data/*.json` + `/admin/` 可视化管理」，而不是写死在模板/CSS 里。
4. **Worker 改动即重部署**：本机已登录 wrangler。改了 `worker/` 下任何文件后，执行 `cd worker && wrangler deploy` 重新部署，否则后台对应功能不生效。
5. **数据文件归后台所有**：`data/music.json`、`data/site.json`、`data/thoughts.json`、`data/life.json`、`content/tech/` 下的分类与笔记均可由后台（Worker）直接提交到远程。**不要在本地手改**；任何本地 push 前先 `git pull --rebase`，否则会覆盖后台新增的内容。（Life 的照片不进仓库，存 Cloudflare R2。）
6. **改动后本地验证**：`hugo`（或 `rm -rf public && hugo`）确认无报错再提交；JS 用 `node --check` 验语法。
7. **发布**：commit + push 到 `main` 即触发 CI 部署；push 属公开发布，需用户明确同意。

## 四、常用命令
```bash
hugo server            # 本地预览（含 /thoughts/ /music/ /admin/ /tech/ /test/）
hugo                   # 构建到 public/
cd worker && wrangler deploy   # 重新部署后端
```

---

# CLAUDE.md

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.
