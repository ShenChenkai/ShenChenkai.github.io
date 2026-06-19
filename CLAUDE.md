# CLAUDE.md — 项目说明 & Agent 工作约定

> 本文件给后续 agent 快速上手用。**改动项目结构后，请同步更新下方「目录树」一节**（见〈Agent 约定〉第 1 条）。

## 一、项目是什么

Chenkai 的个人主页。**Hugo 静态站**，部署在 **GitHub Pages**（`https://ShenChenkai.github.io/`），仓库 `ShenChenkai/ShenChenkai.github.io`，分支 `main`。

附带一个 **Cloudflare Worker 后端**（`worker/`），为 `/admin/` 后台提供：密码登录、音乐链接元数据自动识别（Apple Music / QQ 音乐）、把内容提交回仓库的 `data/*.json`。

### 技术栈 & 部署链路
- **Hugo**（extended，本地 v0.162.1）+ 自建主题 `chenkai-space`。
- **CI**：push 到 `main` → `.github/workflows/hugo.yml` 自动构建并部署到 Pages（来源须设为 GitHub Actions）。
- **后台写数据链路**：`/admin/` 页面 → Cloudflare Worker（持密码 + GitHub Token，均为服务端 secret）→ commit `data/music.json` / `data/site.json` → 触发 CI 重建 → 约 1 分钟上线。
- **主题/配色**：CSS 自定义属性（`--bg/--text/--accent` 等），按 `[data-palette]` + `[data-theme]` 切换；共 17 套配色（9 套常规 + 8 套 NewJeans）。

## 二、目录树（改动后请同步维护）

```
.
├── CLAUDE.md                     # 本文件：项目说明 + agent 约定（含开源 skill）
├── hugo.toml                     # Hugo 配置：站点标题、菜单（Tech/Thoughts/Photos/Music）
├── .github/workflows/hugo.yml    # CI：构建 Hugo 并部署到 GitHub Pages
├── .gitignore                    # 忽略 public/、resources/、.codegraph/、.mcp.json、.claude/、worker 产物等
├── index.html, style.css         # 旧的 "Coming soon" 脚手架（已被 Hugo 站点取代，残留无害）
│
├── archetypes/default.md         # hugo new 的内容模板
├── content/                      # 页面内容（front matter 指定 layout）
│   ├── music/index.md            #   /music/    音乐墙页（layout: music/single）
│   ├── thoughts/index.md         #   /thoughts/ 想法页（layout: thoughts/single）
│   ├── admin/index.md            #   /admin/    后台（不进菜单/sitemap；layout: admin/single）
│   ├── lab/index.md              #   /lab/      想法树画法画廊（6 种程序生成的树；layout: lab/single）
│   └── test/index.md             #   /test/     配色测试页（layout: test/single）
│
├── data/                         # Hugo 数据文件（站点读取 + 后台写入）
│   ├── music.json                #   专辑列表 {albums:[{title,artist,cover,link}]}——后台管理，勿手改
│   ├── thoughts.json             #   想法列表 {posts:[{id,type,date,title,body,source,xUrl}]}——后台管理
│   └── site.json                 #   站点配置 {defaultPalette,defaultMode,particles{...},tree{style,icon,stroke,seed}}——后台管理
│
├── themes/chenkai-space/
│   ├── layouts/
│   │   ├── _default/
│   │   │   ├── baseof.html        # 全站骨架（<html><head><body>）
│   │   │   ├── list.html          # 列表页模板
│   │   │   └── single.html        # 单页默认模板
│   │   ├── index.html             # 首页（hero + tagline）
│   │   ├── partials/
│   │   │   ├── head.html          # <head>：注入默认配色 + 粒子参数为 CSS 变量
│   │   │   ├── header.html        # 顶部导航 + Music 彩色入口块（手绘音符）
│   │   │   └── footer.html        # 页脚
│   │   ├── music/single.html      # 音乐墙：嵌入专辑 JSON + 引 music.js
│   │   ├── thoughts/single.html   # 想法页：顶部按 site.tree 配置渲染想法树（hover 看想法/点跳全文）+ 下方倒序列表
│   │   ├── lab/single.html        # 想法树画廊：6 种树并排展示（program 生成，引 thought-tree.js）
│   │   ├── admin/single.html      # 后台 UI：连接 / 加专辑 / 想法 / 主题色 / 粒子背景 / 想法树 / 列表
│   │   └── test/single.html       # 配色卡片预览页
│   └── static/
│       ├── css/main.css           # 全站样式：配色 tokens、布局、音乐墙、想法卡片、粒子动效、想法树、后台
│       └── js/
│           ├── theme.js           # 明暗/配色切换函数（初始值在 head.html 内联应用）
│           ├── music.js           # 渲染音乐墙：随机打乱、双排反向滚动、占位色块
│           ├── thought-tree.js    # 想法树生成器：递归生长（根粗梢细/不对称/分叉），lab画廊·admin预览·thoughts页共用
│           └── admin.js           # 后台逻辑：调 Worker API（登录/识别/专辑/想法/X抓取/配置/想法树）
│
└── worker/                        # Cloudflare Worker 后端（独立部署，非 Hugo 一部分）
    ├── src/index.js               # Worker 主逻辑：鉴权、Apple/QQ 元数据解析、X 帖子抓取、想法增删、GitHub 读写
    ├── wrangler.toml              # Worker 配置（仓库/路径 vars；secret 不在此）
    └── README.md                  # Worker 部署步骤（secret 设置、wrangler deploy）
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
