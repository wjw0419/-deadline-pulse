# Deadline Pulse · 截止脉搏

**A deadline countdown pill in your DSH conversation header — the closer the deadline, the more it pulses.**

**DSH 会话标题栏右侧的倒计时胶囊——离截止日期越近，胶囊越醒目。**

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
| 📋 Expand panel | Click a pill to see all deadlines: color dot, tag, note, progress bar, completed section |
| 🔔 Threshold toast | When a deadline crosses the 3-day or 24-hour line, a toast slides down (auto-dismiss 5s) |
| 🗣️ Natural language | Say "帮我记个截止日期" and the agent writes to `deadlines.json` via `deadline_tool` |
| 🔄 Hot reload | Edit `deadlines.json` manually → UI syncs within 15s (or instantly on window focus) |

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
"帮我记一个截止日期：周五 18:00 交插件作业，标签'课程'"
"看看我现在有哪些截止日期"
"英语演讲比赛那个截止日完成了"
"把'坏数据测试'那条删掉"
```

The agent calls `deadline_tool` (supports `add` / `list` / `done` / `remove`) and writes to `deadlines.json` in the current workspace.

### Method 2: Manual Edit · 方式二：手动编辑文件

Create/edit `deadlines.json` in the workspace root:

```json
{
  "deadlines": [
    { "title": "提交插件作业", "due": "2026-02-10 18:00", "tag": "课程", "note": "含演示视频", "done": false }
  ]
}
```

- `due` accepts `"2026-02-10 18:00"`, `"2026-02-10"` (treated as 23:59), or ISO format.
- `tag`, `note`, `done`, `created` are all optional.
- Save → UI syncs within 15s; switching window focus triggers instant refresh.

## ⚠️ Notes · 注意事项

1. Each session reads its **own workspace's** `deadlines.json` — deadlines are isolated per workspace.
2. Malformed JSON won't crash the plugin: the panel shows a red "parse failed" message and retains the last successful data.
3. Already-critical items **won't trigger toast on page load** (only when crossing thresholds while the page is open).
4. When "prefers-reduced-motion" is enabled, pulse/swing animations are disabled; only color states remain.
5. Uninstall: say 「用 plugin_manager 移除 @local/deadline-pulse」. Your `deadlines.json` is preserved.

## 📸 Screenshots · 截图

> _TODO: Add screenshots here_
>
> - Empty state with "⏰ 无截止日期" pill
> - Red + yellow pills pulsing in the header
> - Expanded panel with all states
> - Threshold toast notification

## 📄 License · 许可证

[MIT](./LICENSE) © 王小九之父
