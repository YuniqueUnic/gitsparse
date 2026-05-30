# GitSparse (Web)

一款 100% Web 客户端运行的 GitHub 仓库目录与特定文件精细化选择、下载及脚本生成工具。

GitSparse 利用 GitHub REST API 在浏览器前端快速解析仓库文件树结构，支持 Glob 模式的高效过滤和高亮。用户可以通过复选框进行精细化的目录和文件多选，并一键生成包含 `curl` 命令的高内聚本地 Shell 脚本，把大型仓库的下载与同步压力彻底分散到本地终端，节约巨额的克隆带宽与本地磁盘空间。

---

## 核心特色

1. **零服务器中转（100% 客户端运行）**：所有逻辑和网络请求（GitHub API）直接在用户浏览器中进行，零数据中转，保障极速、绝对私密的下载安全。
2. **Access Token 安全存取**：允许用户配置 GitHub Personal Access Token 并安全存储在浏览器 `localStorage` 中。用于解除 GitHub API 频率限制（Rate Limit）并完美支持私有仓库。
3. **IDE 级缩进文件树**：
   * 文件夹复选框具备完整的**半选（Indeterminate）**、全选、未选状态联动。
   * 文件节点显示精确的文件大小，并且**默认优雅折叠**，确保流畅整洁。
4. **Glob 规则高亮与剪枝**：
   * 搭载 300ms 智能防抖（Debounce）处理。
   * 自动过滤文件树，仅展示和自动展开与 Glob 规则匹配的文件及其父级目录结构，同时高亮匹配到的节点。
5. **双模式下载引擎**：
   * **直接 HTTP 模式**：生成带有自定义输出目录（`-o`）的批量 `curl` 或 `wget` 脚本，适合 10 个文件以内的轻量级任务。
   * **Git Sparse 模式**：利用 `git sparse-checkout` 及 `blobless-filter`（`--filter=blob:none`）生成极速 Shell 脚本，在大规模单体仓库中可实现高达 10 倍的下载速度提升。
6. **智能建议弹窗**：当用户选择的文件超过 10 个时，自动提示切换至高性能的 Git Sparse 模式，内置“不再提示”选项。
7. **状态自动恢复**：自动将当前选择的状态保存到浏览器 `localStorage`。刷新浏览器可瞬间恢复先前加载的仓库、分支、Commit SHA、Glob 输入及复选框选中状态，有效避免 Rate-Limit 限制。
8. **3D 交互式 UI 与多语言切换**：
   * 精美的 3D 物理触感按钮，配有可爱的 Q 弹、非遮挡式 `w-10 z-[100]` 项目徽标。
   * 零延迟 localized 多语言切换（支持中文/英文），搭配平滑旋转的地球图标。
9. **极客级 Shell 参数支持**：生成的 Shell 脚本支持交互式 `y/N` 确认提示、自定义目标路径，以及 `-y`/`--yes` 参数实现一键免确认静默下载。
10. **前沿技术栈**：基于 Tailwind CSS v4, TypeScript 6, Vite 8, React 19 构建，生产环境包构建耗时仅需约 400ms，打包体积极小。

---

## 技术栈

* **核心框架**：React 19 (Vite 8)
* **开发语言**：TypeScript 6
* **样式方案**：Tailwind CSS v4 + PostCSS (@tailwindcss/postcss) + Lucide Icons
* **E2E 测试**：Playwright (配置高保真离线 HTTP Mocking)
* **包管理器**：Bun v1.3+

---

## 🚀 快速上手

### 1. 环境准备

项目推荐使用 `Bun` 作为默认的包管理器以获取极致的速度体验：

```bash
bun install
```

### 2. 启动开发服务器

运行以下命令，本地开发服务将在 `http://localhost:3000` 极速启动：

```bash
bun run dev
```

### 3. 生产环境构建

Vite 将在约 **400 毫秒** 内将 TypeScript 与 CSS 编译合并，并在 `dist/` 生成极小体积的生产包：

```bash
bun run build
```

### 4. 运行 E2E 自动化测试

项目配备了高保真的 Playwright 测试用例，覆盖了 URL 自动解析、分支/SHA 切换重载、Glob 规则过滤、以及多选脚本生成等：

```bash
# 自动在后台冷启动开发服务并在数秒内运行完所有 E2E 用例
bunx playwright test
```

---

## 质量门禁

在提交任何更改之前，必须通过以下双重门禁：

1. **类型与构建检查**：`tsc && vite build`（或 `bun run build`）必须实现 **0 errors, 0 warnings**。
2. **自动化测试套件**：`playwright test`（或 `bunx playwright test`）必须实现 **100% 测试通过**。
