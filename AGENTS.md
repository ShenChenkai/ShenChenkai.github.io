# AGENTS.md — 项目说明 & Agent 工作约定

> 本文件给后续 agent 快速上手用。**改动项目结构后，请同步更新下方「目录树」一节**（见〈Agent 约定〉第 1 条）。

## 一、项目是什么

Chenkai 的个人主页。**Hugo 静态站**，部署在 **GitHub Pages**（`https://ShenChenkai.github.io/`），仓库 `ShenChenkai/ShenChenkai.github.io`，分支 `main`。

附带一个 **Cloudflare Worker 后端**（`worker/`），为 `/admin/` 后台提供：密码登录、音乐链接元数据自动识别（Apple Music / QQ 音乐）、把内容提交回仓库的 `data/*.json`。

### 技术栈 & 部署链路
- **Hugo**（extended，本地 v0.162.1）+ 自建主题：本分支（`redesign/y2k-web`）使用 `taochin-y2k`；`chenkai-space` 仍留在仓库里但未启用。
- **CI**：push 到 `main` → `.github/workflows/hugo.yml` 自动构建并部署到 Pages（来源须设为 GitHub Actions）。
- **后台写数据链路**：`/admin/` 页面 → Cloudflare Worker（持密码 + GitHub Token，均为服务端 secret）→ commit `data/music.json` / `data/site.json` → 触发 CI 重建 → 约 1 分钟上线。
- **主题/配色**：CSS 自定义属性（`--bg/--text/--accent` 等），按 `[data-palette]` + `[data-theme]` 切换；共 17 套配色（9 套常规 + 8 套 NewJeans）。

## 二、目录树（改动后请同步维护）

```
.
├── AGENTS.md                     # 本文件：项目说明 + agent 约定（含开源 skill）
├── CLAUDE.md                     # Claude Code 项目说明（main 分支维护，内容与 AGENTS.md 互补）
├── hugo.toml                     # Hugo 配置：站点标题 TaoChn、菜单（想法/技术/音乐/相册/留言），theme = taochin-y2k
├── .github/workflows/hugo.yml    # CI：构建 Hugo 并部署到 GitHub Pages
├── .gitignore                    # 忽略 public/、resources/、.codegraph/、.mcp.json、.Codex/、worker 产物等
├── index.html, style.css         # 旧的 "Coming soon" 脚手架（已被 Hugo 站点取代，残留无害）
│
├── archetypes/default.md         # hugo new 的内容模板
├── content/                      # 页面内容（front matter 指定 layout）
│   ├── music/_index.md           #   /music/      音乐 / 唱片架（列表页）
│   ├── music/_content.gotmpl     #   music 数据 → music-previews.json 的模板（BGM 输出）
│   ├── thoughts/index.md         #   /thoughts/   想法（含生活动态合并流）
│   ├── tech/_index.md            #   /tech/       技术笔记根（分类：clinical / biomedical-signal-process / medical-image-process）
│   ├── photos/index.md           #   /photos/     相册
│   ├── guestbook/index.md        #   /guestbook/  留言本
│   ├── admin/index.md            #   /admin/      后台（不进菜单/sitemap；Y2K 风格，管音乐、想法、留言）
│   └── write/index.md            #   /write/      手机发表入口（不进菜单/sitemap；记住密码后可直接写想法）
│
├── data/                         # Hugo 数据文件（站点读取 + 后台写入）
│   ├── music.json                #   专辑列表 {albums:[{title,artist,cover,slug,year?,link?,tracks:[{title,artist,trackNumber?,preview?,link?}]}]}——按专辑浏览；勿手改。preview 为 Apple 官方试听
│   ├── thoughts.json             #   想法列表 {posts:[{id,type,date,title,body,images,source,xUrl}]}——后台管理；已是真实数据
│   ├── life.json                 #   生活动态 {posts:[{id,date,text,images[]}]}（R2 图床 URL）——Worker 管理；想法页把 life posts 合并进想法流展示
│   ├── guestbook.json            #   访客留言 {messages:[{id,name,body,at}]}——Worker 从 /guestbook/ 公开接口写入，后台可删；勿手改
│   ├── about.json                #   主页简介 {name_zh,name_en,bio,email,portrait,education,projects,papers}——仅本机预览链路（scripts/local-about-admin.py），sample 标记试样
│   └── site.json                 #   站点配置——Worker 管理；y2k 主题为单一视觉，palette 字段当前无效
│
├── static/images/photos/         # 相册版式试样（sea/city/window/night），不是陈凯的照片
│
├── themes/taochin-y2k/           # 本分支正在使用的新主题（从零写，不复用 desk-scene / warm-editorial 代码）
│   ├── theme.toml
│   ├── layouts/
│   │   ├── _default/             #   baseof / list / single
│   │   ├── index.html            #   首页：欢迎、想法、唱片架、试样拍立得、留言本
│   │   ├── partials/             #   head / header（悬挂 logo 签） / footer / thought
│   │   ├── thoughts/single.html  #   想法流：thoughts.json + life.json 按日期合并渲染（生活动态已并入想法栏）
│   │   ├── tech/list.html        #   /tech/ 列表（根=分类，分类=文章），tech/single.html 文章页
│   │   ├── music/single.html
│   │   ├── photos/single.html
│   │   ├── guestbook/single.html
│   │   ├── admin/single.html     #   后台：连接 Worker、专辑、想法、留言管理（暂缺 Life/Tech 管理面板，数据接口已在 Worker 里）
│   │   ├── lab/single.html
│   │   ├── style/single.html
│   │   └── test/single.html
│   └── static/
│       ├── css/main.css          #   白页、悬挂签、水晶按钮、唱片架、拍立得、留言本铬件
│       └── js/
│           ├── main.js
│           ├── admin.js          #   后台：登录、识别专辑、发布/删除想法和专辑（沿用现有 Worker）
│           └── guestbook.js      #   留言：读 Worker 最新列表、提交留言（蜜罐+乐观上墙）；Worker 不可达时回退到静态渲染列表
│
├── themes/chenkai-space/         # 旧主题（main 上的 Life/Tech 版），本分支未启用，勿作当前设计来源
│
└── worker/                       # Cloudflare Worker 后端（独立部署，非 Hugo 一部分）
    ├── src/index.js              #   音乐(含 tracks)/想法/留言(公开 POST)/生活(R2 图床)/技术笔记 接口
    ├── wrangler.toml             #   含 R2 bucket chenkai-life 绑定（LIFE_BUCKET）与各 data 路径 var
    └── README.md
```

## 三、Agent 工作约定（重要）

1. **同步目录树**：每次新增 / 删除 / 重命名文件，或显著改变某文件作用后，必须更新本文件〈二、目录树〉一节，保持准确。
2. **优先用 codegraph MCP**：本目录已配置 codegraph（见 `.mcp.json`）。探索代码、查符号/调用关系时优先用 `codegraph_*` 工具，**减少 token 消耗**，避免大面积 Read/Grep。
3. **可改的网页设计优先做进后台**：凡是日后可能想调整的视觉/内容参数（配色、粒子、专辑、文案等），优先设计成「存 `data/*.json` + `/admin/` 可视化管理」，而不是写死在模板/CSS 里。
4. **Worker 改动即重部署**：本机已登录 wrangler。改了 `worker/` 下任何文件后，执行 `cd worker && wrangler deploy` 重新部署，否则后台对应功能不生效。
5. **数据文件归后台所有**：`data/music.json`、`data/site.json` 由后台（Worker）直接提交到远程。**不要在本地手改**；任何本地 push 前先 `git pull --rebase`，否则会覆盖后台新增的内容。
6. **改动后本地验证**：`hugo`（或 `rm -rf public && hugo`）确认无报错再提交；JS 用 `node --check` 验语法。
7. **发布**：commit + push 到 `main` 即触发 CI 部署；push 属公开发布，需用户明确同意。

## 四、常用命令
```bash
hugo server            # 本地预览（含 /thoughts/ /music/ /admin/ /lab/ /test/）
hugo                   # 构建到 public/
cd worker && wrangler deploy   # 重新部署后端
```

---

# AGENTS.md

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
