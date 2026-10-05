/**
 * deadline-pulse — 浏览器端组件
 * 
 * 在会话标题栏显示截止日期倒计时胶囊，所有会话共享同一份全局数据。
 * 数据通过 Web API 从 ~/.dsh/deadline-pulse/deadlines.json 读取。
 */
window.__ModuleLoader__.load({
	id: '@local/deadline-pulse',
	factory(require) {
		const React = require('react');
		const h = React.createElement;
		const { useState, useEffect, useRef, useCallback } = React;

		const NS = 'deadlinePulse';
		const POLL_MS = 15000;
		const MINUTE = 60e3, HOUR = 60 * MINUTE, DAY = 24 * HOUR;
		const MAX_PILLS = 3;
		const RING_C = 2 * Math.PI * 6;

		// 语言字典
		const zh = {
			'pill.empty': '无截止日期',
			'pill.more': '还有 {n} 条',
			'pill.invalid': '时间无效',
			'panel.title': '截止日期',
			'panel.empty.title': '还没有截止日期',
			'panel.empty.hint': '点击"+ 添加"按钮创建第一个截止日期。',
			'panel.error': '数据加载失败',
			'panel.refresh': '刷新',
			'panel.copy': '复制模板',
			'panel.copied': '已复制',
			'panel.done': '已完成',
			'panel.redone': '恢复',
			'panel.delete': '删除',
			'panel.add': '添加',
			'panel.addForm.title': '标题',
			'panel.addForm.due': '截止时间',
			'panel.addForm.tag': '标签（可选）',
			'panel.addForm.note': '备注（可选）',
			'panel.addForm.submit': '添加',
			'panel.addForm.cancel': '取消',
			'stats.total': '总数',
			'stats.remaining': '剩余',
			'stats.done': '已完成',
			'stats.overdue': '已超期',
			'state.overdue': '已超期',
			'unit.day': '天',
			'toast.72': '进入 3 天倒计时',
			'toast.24': '只剩最后 24 小时',
			'a11y.open': '打开截止日期面板',
			'a11y.close': '关闭截止日期面板'
		};
		const en = {
			'pill.empty': 'No deadlines',
			'pill.more': '+{n} more',
			'pill.invalid': 'invalid time',
			'panel.title': 'Deadlines',
			'panel.empty.title': 'No deadlines yet',
			'panel.empty.hint': 'Click "+ Add" to create your first deadline.',
			'panel.error': 'Failed to load data',
			'panel.refresh': 'Refresh',
			'panel.copy': 'Copy template',
			'panel.copied': 'Copied',
			'panel.done': 'Done',
			'panel.redone': 'Undo',
			'panel.delete': 'Delete',
			'panel.add': 'Add',
			'panel.addForm.title': 'Title',
			'panel.addForm.due': 'Due',
			'panel.addForm.tag': 'Tag (optional)',
			'panel.addForm.note': 'Note (optional)',
			'panel.addForm.submit': 'Add',
			'panel.addForm.cancel': 'Cancel',
			'stats.total': 'Total',
			'stats.remaining': 'Remaining',
			'stats.done': 'Done',
			'stats.overdue': 'Overdue',
			'state.overdue': 'overdue by',
			'unit.day': 'd',
			'toast.72': 'entered the 3-day window',
			'toast.24': 'less than 24 hours left',
			'a11y.open': 'Open deadline panel',
			'a11y.close': 'Close deadline panel'
		};

		// 组件样式
		const CSS = `
.dp-root { position: relative; display: flex; align-items: center; gap: 6px; }
.dp-pill {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 2px 10px 2px 7px; border-radius: 999px; cursor: pointer;
  border: 1px solid var(--dsw-alias-border-l2);
  background: color-mix(in srgb, var(--dsw-alias-bg-overlay) 82%, transparent);
  backdrop-filter: blur(6px);
  color: var(--dsw-alias-label-secondary);
  font-size: 12px; line-height: 18px; white-space: nowrap;
  opacity: .72; transition: opacity .15s ease;
}
.dp-root:hover .dp-pill, .dp-pill:focus-visible { opacity: 1; }
.dp-pill.dp-red {
  color: var(--dsw-alias-state-error-primary); opacity: 1;
  border-color: color-mix(in srgb, var(--dsw-alias-state-error-primary) 55%, transparent);
  animation: dp-breathe 1.6s ease-in-out infinite, dp-nudge 6s linear infinite;
}
.dp-pill.dp-overdue {
  color: var(--dsw-alias-state-error-primary); opacity: 1;
  border-color: var(--dsw-alias-state-error-primary);
  animation: dp-breathe 1s ease-in-out infinite, dp-nudge 3s linear infinite;
}
.dp-pill.dp-yellow {
  color: var(--dsw-alias-state-warn-primary); opacity: 1;
  border-color: color-mix(in srgb, var(--dsw-alias-state-warn-primary) 55%, transparent);
  animation: dp-pulse 2s ease-in-out infinite;
}
.dp-pill.dp-green { color: var(--dsw-alias-state-success-primary); }
.dp-pill.dp-empty { border-style: dashed; }
.dp-title { max-width: 96px; overflow: hidden; text-overflow: ellipsis; font-weight: 500; }
.dp-num { font-variant-numeric: tabular-nums; font-weight: 600; letter-spacing: .01em; }
.dp-ring { flex: none; transform: rotate(-90deg); }
.dp-ring circle { fill: none; stroke-width: 2.4; }
.dp-ring .bg { stroke: var(--dsw-alias-border-l2); }
.dp-ring .fg { stroke: currentColor; stroke-linecap: round; transition: stroke-dasharray .4s ease; }
@keyframes dp-pulse {
  0%, 100% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--dsw-alias-state-warn-primary) 40%, transparent); }
  55% { box-shadow: 0 0 0 5px color-mix(in srgb, var(--dsw-alias-state-warn-primary) 0%, transparent); }
}
@keyframes dp-breathe {
  0%, 100% { box-shadow: 0 0 2px 0 color-mix(in srgb, var(--dsw-alias-state-error-primary) 55%, transparent); }
  50% { box-shadow: 0 0 9px 3px color-mix(in srgb, var(--dsw-alias-state-error-primary) 18%, transparent); }
}
@keyframes dp-nudge {
  0%, 90%, 100% { transform: translateX(0); }
  92% { transform: translateX(-1.5px); }
  94% { transform: translateX(1.5px); }
  96% { transform: translateX(-1px); }
  98% { transform: translateX(1px); }
}
.dp-toastwrap {
  position: fixed; top: 14px; left: 50%; transform: translateX(-50%);
  z-index: 10000; display: flex; flex-direction: column; gap: 8px; align-items: center;
  pointer-events: none;
}
.dp-toast {
  display: flex; align-items: center; gap: 8px;
  padding: 8px 14px; border-radius: 10px; font-size: 13px; max-width: 420px;
  background: var(--dsw-alias-bg-overlay); color: var(--dsw-alias-label-primary);
  border: 1px solid var(--dsw-alias-border-l2);
  box-shadow: 0 6px 24px rgba(0,0,0,.22);
  animation: dp-toast-in .22s ease-out;
}
.dp-toast .dot { width: 8px; height: 8px; border-radius: 50%; flex: none; }
.dp-toast.t72 .dot { background: var(--dsw-alias-state-warn-primary); }
.dp-toast.t24 .dot { background: var(--dsw-alias-state-error-primary); }
@keyframes dp-toast-in { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: none; } }
.dp-panel {
  position: fixed; z-index: 9999; width: 320px; max-height: 70vh; overflow: auto;
  background: var(--dsw-alias-bg-overlay); color: var(--dsw-alias-label-primary);
  border: 1px solid var(--dsw-alias-border-l2); border-radius: 12px;
  box-shadow: 0 10px 32px rgba(0,0,0,.28);
  padding: 12px; font-size: 13px;
  animation: dp-panel-in .16s ease-out;
}
@keyframes dp-panel-in { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: none; } }
.dp-panel header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
.dp-panel header .t { font-weight: 600; font-size: 13px; }
.dp-panel header .n { color: var(--dsw-alias-label-secondary); font-size: 12px; }
.dp-x {
  border: none; background: transparent; cursor: pointer; border-radius: 6px;
  color: var(--dsw-alias-label-secondary); font-size: 14px; line-height: 1; padding: 4px 6px;
}
.dp-x:hover { background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-label-primary); }
.dp-stats {
  display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px;
  padding: 10px; margin: 8px 0; border-radius: 8px;
  background: var(--dsw-alias-bg-layer-2);
}
.dp-stat {
  display: flex; flex-direction: column; align-items: center; gap: 2px;
  padding: 6px 4px; border-radius: 6px; background: var(--dsw-alias-bg-overlay);
}
.dp-stat .num { font-size: 18px; font-weight: 700; font-variant-numeric: tabular-nums; }
.dp-stat .label { font-size: 10px; color: var(--dsw-alias-label-secondary); }
.dp-stat.total .num { color: var(--dsw-alias-label-primary); }
.dp-stat.remaining .num { color: var(--dsw-alias-state-warn-primary); }
.dp-stat.done .num { color: var(--dsw-alias-state-success-primary); }
.dp-stat.overdue .num { color: var(--dsw-alias-state-error-primary); }
.dp-item { padding: 8px 6px; border-radius: 8px; }
.dp-item:hover { background: var(--dsw-alias-bg-layer-2); }
.dp-item .row1 { display: flex; align-items: center; gap: 7px; }
.dp-item .dot { width: 8px; height: 8px; border-radius: 50%; flex: none; }
.dp-item.s-overdue .dot, .dp-item.s-red .dot { background: var(--dsw-alias-state-error-primary); }
.dp-item.s-yellow .dot { background: var(--dsw-alias-state-warn-primary); }
.dp-item.s-green .dot { background: var(--dsw-alias-state-success-primary); }
.dp-item.s-calm .dot, .dp-item.s-invalid .dot { background: var(--dsw-alias-state-idle-primary); }
.dp-item .title { font-weight: 600; flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dp-item .tag {
  flex: none; font-size: 11px; padding: 0 6px; border-radius: 999px;
  border: 1px solid var(--dsw-alias-border-l1); color: var(--dsw-alias-label-secondary);
}
.dp-item .when { flex: none; font-variant-numeric: tabular-nums; font-size: 12px; }
.dp-item.s-overdue .when, .dp-item.s-red .when { color: var(--dsw-alias-state-error-primary); font-weight: 600; }
.dp-item.s-yellow .when { color: var(--dsw-alias-state-warn-primary); font-weight: 600; }
.dp-item .note { color: var(--dsw-alias-label-secondary); font-size: 12px; margin: 3px 0 0 15px; }
.dp-item .bar { height: 3px; border-radius: 2px; background: var(--dsw-alias-border-l1); margin: 6px 0 0 15px; overflow: hidden; }
.dp-item .bar i { display: block; height: 100%; border-radius: 2px; }
.dp-item.s-overdue .bar i, .dp-item.s-red .bar i { background: var(--dsw-alias-state-error-primary); }
.dp-item.s-yellow .bar i { background: var(--dsw-alias-state-warn-primary); }
.dp-item.s-green .bar i { background: var(--dsw-alias-state-success-primary); }
.dp-item.s-calm .bar i { background: var(--dsw-alias-state-idle-primary); }
.dp-done { margin-top: 8px; padding-top: 8px; border-top: 1px solid var(--dsw-alias-border-l1); }
.dp-done .title { color: var(--dsw-alias-label-secondary); text-decoration: line-through; font-weight: 400; }
.dp-emptybox { text-align: center; padding: 14px 8px; color: var(--dsw-alias-label-secondary); }
.dp-emptybox .big { font-size: 22px; margin-bottom: 6px; }
.dp-emptybox p { margin: 0 0 10px; font-size: 12px; line-height: 1.6; }
.dp-errorbox { padding: 10px; border-radius: 8px; font-size: 12px; line-height: 1.6;
  color: var(--dsw-alias-state-error-primary);
  background: color-mix(in srgb, var(--dsw-alias-state-error-primary) 10%, transparent); }
.dp-btn {
  border: 1px solid var(--dsw-alias-border-l2); background: transparent; cursor: pointer;
  color: var(--dsw-alias-label-primary); font-size: 12px; padding: 4px 10px; border-radius: 8px;
}
.dp-btn:hover { background: var(--dsw-alias-bg-layer-2); }
.dp-btn.primary { border-color: var(--dsw-alias-brand-primary); color: var(--dsw-alias-brand-primary); }
.dp-foot { display: flex; align-items: center; justify-content: space-between; gap: 8px;
  margin-top: 10px; padding-top: 8px; border-top: 1px solid var(--dsw-alias-border-l1); }
.dp-foot .hint { color: var(--dsw-alias-label-secondary); font-size: 11px; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dp-foot .acts { display: flex; gap: 6px; flex: none; }
.dp-add-form { margin-top: 10px; padding: 10px; border-radius: 8px; background: var(--dsw-alias-bg-layer-2); }
.dp-add-form .field { margin-bottom: 8px; }
.dp-add-form label { display: block; font-size: 11px; color: var(--dsw-alias-label-secondary); margin-bottom: 3px; }
.dp-add-form input, .dp-add-form textarea {
  width: 100%; padding: 5px 8px; border: 1px solid var(--dsw-alias-border-l1);
  border-radius: 6px; background: var(--dsw-alias-bg-overlay); color: var(--dsw-alias-label-primary);
  font-size: 12px; font-family: inherit;
}
.dp-add-form input:focus, .dp-add-form textarea:focus { outline: none; border-color: var(--dsw-alias-brand-primary); }
.dp-add-form textarea { resize: vertical; min-height: 40px; }
.dp-add-form .actions { display: flex; gap: 6px; justify-content: flex-end; margin-top: 8px; }
@media (prefers-reduced-motion: reduce) {
  .dp-pill { animation: none !important; }
}
`;

		/**
		 * 解析截止时间字符串为本地时间戳
		 */
		function dueMs(raw) {
			if (typeof raw !== 'string') return undefined;
			let s = raw.trim();
			if (!s) return undefined;
			if (/^\d{4}-\d{2}-\d{2}$/.test(s)) s += 'T23:59:59';
			else s = s.replace(' ', 'T');
			const ms = Date.parse(s);
			return Number.isFinite(ms) ? ms : undefined;
		}

		/**
		 * 解析 deadlines.json 内容
		 */
		function parseItems(data) {
			const arr = Array.isArray(data) ? data
				: (data && Array.isArray(data.deadlines) ? data.deadlines : null);
			if (!arr) return null;
			const out = [];
			for (const raw of arr) {
				if (!raw || typeof raw !== 'object') continue;
				if (typeof raw.title !== 'string' || !raw.title.trim()) continue;
				const due = dueMs(raw.due);
				const created = typeof raw.created === 'string' ? Date.parse(raw.created) : NaN;
				out.push({
					key: raw.title.trim() + '|' + String(raw.due),
					title: raw.title.trim(),
					dueText: typeof raw.due === 'string' ? raw.due : '',
					due,
					created: Number.isFinite(created) ? created : undefined,
					tag: typeof raw.tag === 'string' ? raw.tag.trim() : '',
					note: typeof raw.note === 'string' ? raw.note.trim() : '',
					done: raw.done === true
				});
			}
			return out;
		}

		/**
		 * 判断条目状态
		 */
		function stateOf(item, now) {
			if (item.done) return 'done';
			if (item.due === undefined) return 'invalid';
			const left = item.due - now;
			if (left <= 0) return 'overdue';
			if (left <= DAY) return 'red';
			if (left <= 3 * DAY) return 'yellow';
			if (left <= 7 * DAY) return 'green';
			return 'calm';
		}

		const pad2 = (n) => String(n).padStart(2, '0');

		/**
		 * 倒计时格式化
		 */
		function countdown(item, now, t) {
			if (item.due === undefined) return t('pill.invalid');
			let left = item.due - now;
			let overdue = false;
			if (left <= 0) { overdue = true; left = -left; }
			const d = Math.floor(left / DAY);
			const hh = Math.floor(left % DAY / HOUR);
			const mm = Math.floor(left % HOUR / MINUTE);
			const ss = Math.floor(left % MINUTE / 1000);
			const core = d > 0
				? `${d}${t('unit.day')} ${pad2(hh)}:${pad2(mm)}:${pad2(ss)}`
				: `${pad2(hh)}:${pad2(mm)}:${pad2(ss)}`;
			return overdue ? `${t('state.overdue')} ${core}` : core;
		}

		/**
		 * 计算消耗比例（用于进度环/条）
		 */
		function consumed(item, now) {
			if (item.due === undefined) return 0;
			const start = item.created !== undefined ? item.created : item.due - 7 * DAY;
			const total = item.due - start;
			if (!(total > 0)) return item.due <= now ? 1 : 0;
			return Math.min(1, Math.max(0, (now - start) / total));
		}

		/** 进度环组件 */
		function Ring({ frac }) {
			return h('svg', { className: 'dp-ring', viewBox: '0 0 16 16', width: 14, height: 14, 'aria-hidden': true },
				h('circle', { className: 'bg', cx: 8, cy: 8, r: 6 }),
				h('circle', {
					className: 'fg', cx: 8, cy: 8, r: 6,
					style: { strokeDasharray: `${(frac * RING_C).toFixed(2)} ${RING_C.toFixed(2)}` }
				}));
		}

		/**
		 * 主组件：截止日期脉冲
		 */
		function DeadlinePulse(props) {
			const { t: rawT } = props;
			const t = useCallback((key) => {
				try { const v = rawT(key); return typeof v === 'string' && v ? v : key; } catch { return key; }
			}, [rawT]);

			const [items, setItems] = useState([]);
			const [status, setStatus] = useState('loading');
			const [errorMsg, setErrorMsg] = useState('');
			const [now, setNow] = useState(() => Date.now());
			const [open, setOpen] = useState(false);
			const [panelPos, setPanelPos] = useState(null);
			const [copied, setCopied] = useState(false);
			const [toasts, setToasts] = useState([]);
			const [toastMsg, setToastMsg] = useState('');
			const [showAddForm, setShowAddForm] = useState(false);
			const [addForm, setAddForm] = useState({ title: '', due: '', tag: '', note: '' });
			const rootRef = useRef(null);
			const panelRef = useRef(null);
			const buckets = useRef(new Map());
			const toastTimers = useRef([]);
			const loadRef = useRef(null);

			/** 从全局 API 加载数据 */
			const load = useCallback(async () => {
				try {
					const res = await fetch("/api/deadline-pulse/list");
					const result = await res.json();
					
					if (!result.ok) {
						const errMsg = `读取失败：${result.message || '未知错误'}`;
						console.error('[deadline-pulse]', errMsg, result);
						setErrorMsg(errMsg);
						setItems([]);
						setStatus('broken');
						return;
					}
					
					const parsed = parseItems(result.deadlines || []);
					if (parsed === null) {
						setErrorMsg('数据格式错误');
						setStatus('broken');
						return;
					}
					setItems(parsed);
					setStatus('ok');
					setErrorMsg('');
				} catch (err) {
					const errMsg = `异常：${err.message || String(err)}`;
					console.error('[deadline-pulse] read exception:', errMsg, err);
					setErrorMsg(errMsg);
					setStatus((s) => (s === 'ok' || s === 'broken' ? s : 'missing'));
				}
			}, []);
			loadRef.current = load;

			// 轮询 + 焦点刷新
			useEffect(() => {
				let stopped = false;
				const tick = () => { if (!stopped) load(); };
				tick();
				const iv = setInterval(tick, POLL_MS);
				window.addEventListener('focus', tick);
				return () => { stopped = true; clearInterval(iv); window.removeEventListener('focus', tick); };
			}, [load]);

			// 每秒更新倒计时
			useEffect(() => {
				const iv = setInterval(() => setNow(Date.now()), 1000);
				return () => clearInterval(iv);
			}, []);

			// 清理 toast 定时器
			useEffect(() => () => { toastTimers.current.forEach(clearTimeout); }, []);

			/** 推送阈值提醒 toast */
			const pushToast = useCallback((kind, title) => {
				const id = `${kind}|${title}|${Date.now()}`;
				setToasts((cur) => [...cur.slice(-2), { id, kind, title }]);
				const timer = setTimeout(() => setToasts((cur) => cur.filter((x) => x.id !== id)), 5000);
				toastTimers.current.push(timer);
			}, []);

			// 检测阈值跨越
			useEffect(() => {
				if (status !== 'ok') return;
				const next = new Map();
				for (const item of items) {
					if (item.done || item.due === undefined) continue;
					const left = item.due - now;
					const bucket = left <= DAY ? '24' : left <= 3 * DAY ? '72' : 'none';
					const prev = buckets.current.has(item.key) ? buckets.current.get(item.key) : null;
					next.set(item.key, bucket);
					if (prev !== null && prev !== bucket && bucket !== 'none') pushToast(bucket, item.title);
				}
				buckets.current = next;
			}, [items, now, status, pushToast]);

			/** 打开面板 */
			const openPanel = useCallback(() => {
				if (loadRef.current) loadRef.current();
				const rect = rootRef.current ? rootRef.current.getBoundingClientRect() : null;
				setPanelPos(rect ? { top: rect.bottom + 8, right: Math.max(8, window.innerWidth - rect.right) } : { top: 56, right: 12 });
				setOpen(true);
			}, []);

			/** 切换面板 */
			const togglePanel = useCallback(() => {
				if (open) setOpen(false);
				else openPanel();
			}, [open, openPanel]);

			// 外部点击/Escape 关闭面板
			useEffect(() => {
				if (!open) return undefined;
				const onDown = (e) => {
					const inRoot = rootRef.current && rootRef.current.contains(e.target);
					const inPanel = panelRef.current && panelRef.current.contains(e.target);
					if (!inRoot && !inPanel) setOpen(false);
				};
				const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
				document.addEventListener('mousedown', onDown);
				document.addEventListener('keydown', onKey);
				return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
			}, [open]);

			/** 删除条目 */
			const handleDelete = async (item) => {
				try {
					const res = await fetch("/api/deadline-pulse/action", {
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({ action: "remove", title: item.title })
					});
					const result = await res.json();
					if (result.ok) {
						setToastMsg(`已删除「${item.title}」`);
						setTimeout(() => setToastMsg(""), 3000);
						load();
					} else {
						setToastMsg(`删除失败：${result.message}`);
						setTimeout(() => setToastMsg(""), 3000);
					}
				} catch (err) {
					setToastMsg(`删除失败：${err.message}`);
					setTimeout(() => setToastMsg(""), 3000);
				}
			};

			/** 完成条目 */
			const handleDone = async (item) => {
				try {
					const res = await fetch("/api/deadline-pulse/action", {
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({ action: "done", title: item.title })
					});
					const result = await res.json();
					if (result.ok) {
						setToastMsg(`已完成「${item.title}」`);
						setTimeout(() => setToastMsg(""), 3000);
						load();
					} else {
						setToastMsg(`完成失败：${result.message}`);
						setTimeout(() => setToastMsg(""), 3000);
					}
				} catch (err) {
					setToastMsg(`完成失败：${err.message}`);
					setTimeout(() => setToastMsg(""), 3000);
				}
			};

			/** 复制模板 */
			const copyTemplate = useCallback(() => {
				const template = JSON.stringify({
					deadlines: [
						{ title: '示例：提交作业', due: '2026-10-16 18:00', tag: '课程', note: '含演示视频', done: false }
					]
				}, null, 2);
				const done = () => { setCopied(true); setTimeout(() => setCopied(false), 1600); };
				if (navigator.clipboard && navigator.clipboard.writeText) {
					navigator.clipboard.writeText(template).then(done, done);
				} else {
					done();
				}
			}, []);

			// 分类和排序
			const classified = items.map((item) => ({ item, state: stateOf(item, now) }));
			const urgent = classified
				.filter((x) => x.state === 'overdue' || x.state === 'red' || x.state === 'yellow')
				.sort((a, b) => a.item.due - b.item.due);
			const shown = urgent.slice(0, MAX_PILLS);
			const overflow = urgent.length - shown.length;
			const nearestCalm = urgent.length === 0
				? classified.filter((x) => x.state !== 'done' && x.state !== 'invalid')
					.sort((a, b) => a.item.due - b.item.due)[0]
				: undefined;

			// 统计
			const active = classified.filter((x) => x.state !== 'done').sort((a, b) => (a.item.due ?? Infinity) - (b.item.due ?? Infinity));
			const done = classified.filter((x) => x.state === 'done');
			const overdue = active.filter((x) => x.state === 'overdue' || x.state === 'red');
			const remaining = active.length;
			const total = active.length + done.length;

			/** 单个胶囊 */
			const pill = (entry, state) => h('button', {
				key: entry.item.key,
				type: 'button',
				className: `dp-pill dp-${state}`,
				title: `${entry.item.title} · ${entry.item.dueText}`,
				onClick: togglePanel,
				'aria-label': t('a11y.open')
			},
				h(Ring, { frac: consumed(entry.item, now) }),
				h('span', { className: 'dp-title' }, entry.item.title),
				h('span', { className: 'dp-num' }, countdown(entry.item, now, t)));

			const pills = shown.map((entry) => pill(entry, entry.state));
			if (overflow > 0) {
				pills.push(h('button', {
					key: '+n', type: 'button', className: 'dp-pill dp-red',
					onClick: togglePanel, 'aria-label': t('a11y.open')
				}, h('span', { className: 'dp-num' }, t('pill.more').replace('{n}', String(overflow)))));
			}
			if (!pills.length) {
				if (nearestCalm) pills.push(pill(nearestCalm, nearestCalm.state));
				else pills.push(h('button', {
					key: 'empty', type: 'button', className: 'dp-pill dp-empty',
					onClick: togglePanel, 'aria-label': t('a11y.open')
				}, '⏰', h('span', { className: 'dp-title' }, t('pill.empty'))));
			}

			/** 单个条目行 */
			const row = ({ item, state }, doneSection) => h('div', { key: item.key, className: `dp-item s-${state}` },
				h('div', { className: 'row1' },
					h('span', { className: 'dot' }),
					h('span', { className: 'title' }, item.title),
					item.tag ? h('span', { className: 'tag' }, item.tag) : null,
					h('span', { className: 'when' }, state === 'done' ? t('panel.done') : countdown(item, now, t)),
					!doneSection && state !== 'invalid' ? h('div', { style: { display: 'flex', gap: '4px' } },
						h('button', {
							type: 'button', className: 'dp-btn', style: { fontSize: '11px', padding: '2px 6px' },
							onClick: () => handleDone(item), title: '完成'
						}, '✓'),
						h('button', {
							type: 'button', className: 'dp-btn', style: { fontSize: '11px', padding: '2px 6px', color: 'var(--dsw-alias-state-error-primary)' },
							onClick: () => handleDelete(item), title: '删除'
						}, '🗑')
					) : null),
				item.note && !doneSection ? h('div', { className: 'note' }, item.note) : null,
				state !== 'done' && state !== 'invalid'
					? h('div', { className: 'bar' }, h('i', { style: { width: `${Math.round(consumed(item, now) * 100)}%` } }))
					: null);

			// 统计面板
			const stats = h('div', { className: 'dp-stats' },
				h('div', { className: 'dp-stat total' },
					h('span', { className: 'num' }, total),
					h('span', { className: 'label' }, t('stats.total'))),
				h('div', { className: 'dp-stat remaining' },
					h('span', { className: 'num' }, remaining),
					h('span', { className: 'label' }, t('stats.remaining'))),
				h('div', { className: 'dp-stat done' },
					h('span', { className: 'num' }, done.length),
					h('span', { className: 'label' }, t('stats.done'))),
				h('div', { className: 'dp-stat overdue' },
					h('span', { className: 'num' }, overdue.length),
					h('span', { className: 'label' }, t('stats.overdue'))));

			// 面板内容
			const panel = open ? h('div', {
				className: 'dp-panel', ref: panelRef,
				style: { top: panelPos ? panelPos.top : 56, right: panelPos ? panelPos.right : 12 },
				role: 'dialog', 'aria-label': t('panel.title')
			},
				h('header', null,
					h('span', null, h('span', { className: 't' }, t('panel.title')),
						h('span', { className: 'n' }, `  ${total}`)),
					h('button', { type: 'button', className: 'dp-x', onClick: () => setOpen(false), 'aria-label': t('a11y.close') }, '✕')),
				items.length ? stats : null,
				status === 'broken'
					? h('div', { className: 'dp-errorbox' },
						h('div', null, t('panel.error')),
						errorMsg ? h('div', { style: { marginTop: '8px', fontSize: '11px', opacity: 0.8 } }, errorMsg) : null)
					: !items.length
						? h('div', { className: 'dp-emptybox' },
							h('div', { className: 'big' }, '⏰'),
							h('div', null, t('panel.empty.title')),
							h('p', null, t('panel.empty.hint')),
							errorMsg ? h('div', { style: { marginTop: '8px', fontSize: '11px', color: 'var(--dsw-alias-state-error-primary)' } }, errorMsg) : null,
							h('button', {
								type: 'button', className: 'dp-btn primary', style: { marginTop: '10px' },
								onClick: () => setShowAddForm(true),
							}, `+ ${t('panel.add')}`))
						: h('div', null,
							active.map((entry) => row(entry, false)),
							done.length ? h('div', { className: 'dp-done' }, done.map((entry) => row(entry, true))) : null,
							h('div', { style: { marginTop: '10px', paddingTop: '8px', borderTop: '1px solid var(--dsw-alias-border-l1)' } },
								showAddForm
									? h('div', { className: 'dp-add-form' },
										h('div', { className: 'field' },
											h('label', null, t('panel.addForm.title')),
											h('input', { type: 'text', value: addForm.title, onChange: (e) => setAddForm({ ...addForm, title: e.target.value }) })),
										h('div', { className: 'field' },
											h('label', null, t('panel.addForm.due')),
											h('input', { type: 'text', value: addForm.due, onChange: (e) => setAddForm({ ...addForm, due: e.target.value }), placeholder: '2026-10-16 或 2026-10-16 18:00' })),
										h('div', { className: 'field' },
											h('label', null, t('panel.addForm.tag')),
											h('input', { type: 'text', value: addForm.tag, onChange: (e) => setAddForm({ ...addForm, tag: e.target.value }) })),
										h('div', { className: 'field' },
											h('label', null, t('panel.addForm.note')),
											h('textarea', { value: addForm.note, onChange: (e) => setAddForm({ ...addForm, note: e.target.value }) })),
										h('div', { className: 'actions' },
											h('button', {
												type: 'button', className: 'dp-btn', onClick: () => { setShowAddForm(false); setAddForm({ title: '', due: '', tag: '', note: '' }); },
											}, t('panel.addForm.cancel')),
											h('button', {
												type: 'button', className: 'dp-btn primary',
												onClick: async () => {
													try {
														const res = await fetch("/api/deadline-pulse/action", {
															method: "POST",
															headers: { "Content-Type": "application/json" },
															body: JSON.stringify({
																action: "add",
																title: addForm.title,
																due: addForm.due,
																tag: addForm.tag,
																note: addForm.note
															})
														});
														const result = await res.json();
														if (result.ok) {
															setToastMsg(`已添加「${addForm.title}」`);
															setTimeout(() => setToastMsg(""), 3000);
															setShowAddForm(false);
															setAddForm({ title: '', due: '', tag: '', note: '' });
															load();
														} else {
															setToastMsg(`添加失败：${result.message}`);
															setTimeout(() => setToastMsg(""), 3000);
														}
													} catch (err) {
														setToastMsg(`添加失败：${err.message}`);
														setTimeout(() => setToastMsg(""), 3000);
													}
												},
											}, t('panel.addForm.submit'))))
									: h('button', {
										type: 'button', className: 'dp-btn primary', style: { width: '100%' },
										onClick: () => setShowAddForm(true),
									}, `+ ${t('panel.add')}`))),
				h('div', { className: 'dp-foot' },
					h('span', { className: 'hint' }, '数据文件：~/.dsh/deadline-pulse/deadlines.json'),
					h('span', { className: 'acts' },
						h('button', { type: 'button', className: 'dp-btn', onClick: () => load() }, t('panel.refresh')),
						items.length ? h('button', { type: 'button', className: 'dp-btn', onClick: copyTemplate }, copied ? t('panel.copied') : t('panel.copy')) : null))
			) : null;

			// Toast 层
			const toastLayer = h('div', { className: 'dp-toastwrap' },
				...toasts.map((x) => h('div', { key: x.id, className: `dp-toast t${x.kind}` },
					h('span', { className: 'dot' }),
					h('span', null, `${x.title} · ${t(`toast.${x.kind}`)}`))),
				toastMsg ? h('div', { key: 'msg', className: 'dp-toast' },
					h('span', { className: 'dot', style: { background: 'var(--dsw-alias-state-success-primary)' } }),
					h('span', null, toastMsg)) : null);

			return h('div', { className: 'dp-root', ref: rootRef },
				h('style', null, CSS),
				pills,
				panel,
				toastLayer);
		}

		const inject = ['slots', 'locale'];

		function apply(ctx) {
			ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'deadline-pulse: dictionaries');
			ctx.slots.inject('conversation.session.header.utilities', () => ctx.slots.register({
				name: 'conversation.session.header.utilities',
				id: 'deadline-pulse',
				order: 50,
				locale: NS,
				inject: () => ({ t: ctx.locale.bind(NS) })
			}, DeadlinePulse));
		}

		return { inject, apply };
	},
});
