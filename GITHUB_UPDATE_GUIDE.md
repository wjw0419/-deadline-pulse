# Deadline Pulse v1.1 — GitHub 更新上传教程

本教程指导你将 deadline-pulse v1.1（冲突检测 + AI 协商调度）更新推送到 GitHub 仓库。

---

## 前置条件

- [x] 已安装 Git（终端能运行 `git --version`）
- [x] 已在 GitHub 上创建仓库（如 `https://github.com/你的用户名/deadline-pulse`）
- [x] 本地插件目录已关联远程仓库（首次推送需执行 `git remote add`）

---

## 第一步：检查当前状态

```bash
cd /path/to/deadline-pulse
git status
```

确认以下文件已被修改：
- `index.js` — 新增 conflicts / reschedule action、effort 字段支持
- `client.js` — 冲突检测 UI、reschedule 表单、effort 显示
- `package.json` — 版本号升至 1.1.0
- `README.md` — 新增 v1.1 功能说明
- `插件说明文档.md` — 更新使用文档
- `locale/zh.json` — 更新描述
- `locale/en.json` — 更新描述

---

## 第二步：暂存所有变更

```bash
git add -A
```

---

## 第三步：提交（附带有意义的 commit message）

```bash
git commit -m "feat(v1.1): 多 Deadline 冲突检测 + AI 协商调度

- 新增 conflicts action：扫描未完成 deadline 的准备窗口重叠和同日到期
- 三级冲突严重度：high（同日+窗口重叠）、medium（窗口重叠）、low（同日）
- 新增 reschedule action：一键调整截止时间和预估工时
- 新增 effort 字段：预估工时（小时），用于冲突窗口计算
- 面板新增冲突检测按钮、冲突结果卡片、内联 reschedule 表单
- 条目行显示 effort chip 和冲突闪电图标
- 中英文国际化文案同步更新
- README 和插件说明文档同步更新"
```

> 💡 **Commit Message 规范建议**：使用 [Conventional Commits](https://www.conventionalcommits.org/) 格式，方便后续生成 CHANGELOG。

---

## 第四步：推送到 GitHub

### 情况 A：已有远程仓库

```bash
git push origin main
```

如果你的默认分支是 `master`：
```bash
git push origin master
```

### 情况 B：首次推送到新仓库

```bash
# 添加远程仓库
git remote add origin https://github.com/你的用户名/deadline-pulse.git

# 首次推送并设置上游
git push -u origin main
```

### 情况 C：使用 SSH

```bash
git remote set-url origin git@github.com:你的用户名/deadline-pulse.git
git push origin main
```

---

## 第五步：创建 Release（推荐）

在 GitHub 网页上：

1. 进入仓库 → **Releases** → **Draft a new release**
2. Tag version: `v1.1.0`
3. Release title: `Deadline Pulse v1.1.0 — 冲突检测 + AI 协商调度`
4. 填写 Release Notes：

```markdown
## 🆕 What's New in v1.1

### ⚡ Conflict Detection
- Scan all active deadlines for preparation window overlaps and same-day conflicts
- Three severity levels: 🔴 High / 🟡 Medium / 🟢 Low
- Panel button triggers detection; results show inline with reschedule shortcuts

### 📅 Reschedule
- One-click reschedule from panel item row or conflict result cards
- Supports adjusting both due time and estimated effort

### ⏱️ Effort Tracking
- Optional `effort` field (hours) per deadline
- Used for conflict window calculation (default: 2h when unset)
- Displayed as colored chip in panel

### 🗣️ Natural Language
- "检查一下冲突" → agent calls `conflicts` action
- "把XX调整到下周" → agent calls `reschedule` action

## 📦 Install
See [README.md](./README.md) for installation instructions.
```

5. 点击 **Publish release**

---

## 第六步：验证

1. 打开 GitHub 仓库页面，确认最新 commit 和文件内容正确
2. 确认 Release 页面显示 v1.1.0
3. （可选）在新环境中克隆仓库测试安装：
   ```bash
   git clone https://github.com/你的用户名/deadline-pulse.git
   ```
   然后在 DSH 中安装验证。

---

## 常见问题

### Q: push 时报错 `rejected` / `non-fast-forward`
远程有你本地没有的提交。先拉取再推送：
```bash
git pull --rebase origin main
git push origin main
```

### Q: 只想推送部分文件
不要 `git add -A`，改为逐个添加：
```bash
git add index.js client.js package.json
git commit -m "feat: conflict detection core"
git push origin main
```

### Q: 想打 tag 但不创建 Release
```bash
git tag -a v1.1.0 -m "v1.1.0: 冲突检测 + AI 协商调度"
git push origin v1.1.0
```

### Q: 推送后想撤回
```bash
# 撤回最近一次 commit（保留修改在工作区）
git reset --soft HEAD~1

# 强制推送覆盖远程（⚠️ 谨慎使用）
git push --force origin main
```

---

## 版本历史

| Version | Date | Highlights |
|---------|------|------------|
| v1.0.0 | 2026-02 | 初版：倒计时胶囊、四色状态、Toast 提醒、面板 CRUD |
| v1.1.0 | 2026-07 | 冲突检测、AI 协商调度、预估工时、reschedule |
