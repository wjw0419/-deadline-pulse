# Deadline Pulse · 截止脉搏

**A deadline countdown pill in your DSH conversation header — the closer the deadline, the more it pulses.**
**v1.1: Multi-deadline conflict detection + AI-assisted rescheduling.**

**DSH 会话标题栏右侧的倒计时胶囊——离截止日期越近，胶囊越醒目。**
**v1.1 新增：多 Deadline 冲突检测 + AI 协商调度。**

---

## ✨ Features · 功能

| Feature | Description |
|---------|-------------|
| 🕐 Countdown pill | Persistent in the header, ticking every second with monospace digits |
| 🔴 ≤1 day | Breathing glow + swing animation (includes overdue) |
| 🟡 ≤3 days | Pulse animation |
| 🟢 ≤7 days | Only visible in the expanded panel |
| ⚪ >7 days | Only visible in the expanded panel |
| 📊 Ring progress | Each pill shows a ring indicating life consumed |
| 📋 Expand panel | Click a pill to see all deadlines: color dot, tag, note, effort, progress bar, completed section |
| 🔔 Threshold toast | When a deadline crosses the 3-day or 24-hour line, a toast slides down (auto-dismiss 5s) |
| ⚡ **Conflict Detection** | Detect overlapping preparation windows between deadlines; severity levels: high/medium/low |
| 📅 **Reschedule** | One-click reschedule from the panel or conflict results; supports effort adjustment |
| ⏱️ **Effort Tracking** | Optional estimated effort (hours) per deadline; used for conflict window calculation |
| 🗣️ Natural language | Say "帮我记个截止日期" or "检查一下冲突" and the agent handles it via `deadline_tool` |
| 🔄 Hot reload | Edit `deadlines.json` manually → UI syncs within 15s (or instantly on window focus) |

## 🆕 v1.1 What's New · 更新内容

### ⚡ Conflict Detection · 冲突检测
- New `conflicts` action: scans all active deadlines for time conflicts
- Three severity levels:
  - 🔴 **High**: Same-day due + preparation windows overlap
  - 🟡 **Medium**: Preparation windows overlap (different days)
  - 🟢 **Low**: Same-day due but no window overlap
- Preparation window = `[due - effort, due]`; defaults to 2h if effort not set
- Panel button "⚡ 冲突检测" triggers detection; results show inline with reschedule shortcuts

### 📅 Reschedule · 重新调度
- New `reschedule` action: change any deadline's due time (and optionally effort)
- Available from: panel item row (📅 button), conflict result cards, or natural language
- After reschedule, conflict detection auto-refreshes if previously run

### ⏱️ Effort Field · 预估工时
- New optional `effort` field (hours) when adding deadlines
- Displayed as a colored chip in the panel item row
- Used by conflict detection to calculate preparation windows
- Default assumption: 2 hours when effort is not specified

## 📦 Install · 安装

### Via DSH Agent · 通过代理安装

In any DSH session, say:

> 用 plugin_manager 的 install_bundle 安装本地插件 `<absolute-path-to>/deadline-pulse`

Or equivalently, the agent calls:

```
plugin_manager { action: "install_bundle", target: "<absolute-path-to>\\deadline-pulse" }
```

After install returns `application: applied`, **refresh the browser page (F5)** to load the client module.

### Via CLI · 命令行安装

```bash
dsh plugin --profile <your-profile> add "file:<absolute-path-to>/deadline-pulse"
```

## 📖 Usage · 使用

### Method 1: Talk to the Agent · 方式一：对代理说话（推荐）

```
"帮我记一个截止日期：周五 18:00 交插件作业，标签'课程'，预估 4 小时"
"看看我现在有哪些截止日期"
"检查一下我的截止日期有没有冲突"
"把英语演讲比赛调整到下周一"
"英语演讲比赛那个截止日完成了"
"把'坏数据测试'那条删掉"
```

The agent calls `deadline_tool` (supports `add` / `list` / `done` / `remove` / `conflicts` / `reschedule`) and writes to `deadlines.json`.

### Method 2: Manual Edit · 方式二：手动编辑文件

Create/edit `~/.dsh/deadline-pulse/deadlines.json`:

```json
{
  "deadlines": [
    { "title": "提交插件作业", "due": "2026-02-10 18:00", "tag": "课程", "note": "含演示视频", "effort": 4, "done": false },
    { "title": "英语演讲比赛", "due": "2026-02-10 15:00", "tag": "社团", "effort": 3, "done": false }
  ]
}
```

- `due` accepts `"2026-02-10 18:00"`, `"2026-02-10"` (treated as 23:59), or ISO format.
- `tag`, `note`, `effort`, `done`, `created` are all optional.
- Save → UI syncs within 15s; switching window focus triggers instant refresh.

## ⚠️ Notes · 注意事项

1. Data is stored globally at `~/.dsh/deadline-pulse/deadlines.json` — shared across all sessions.
2. Malformed JSON won't crash the plugin: the panel shows a red "parse failed" message and retains the last successful data.
3. Already-critical items **won't trigger toast on page load** (only when crossing thresholds while the page is open).
4. When "prefers-reduced-motion" is enabled, pulse/swing animations are disabled; only color states remain.
5. Conflict detection requires at least 2 active (non-done) deadlines.
6. Uninstall: say 「用 plugin_manager 移除 @local/deadline-pulse」. Your `deadlines.json` is preserved.

## 📄 License · 许可证

[MIT](./LICENSE) © 王小九之父
