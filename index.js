/**
 * deadline-pulse — Host half.
 * 
 * 全局截止日期管理插件：
 * - 注册 deadline_tool 供模型调用
 * - 提供 Web API 供客户端直接操作
 * - 数据存储在 ~/.dsh/deadline-pulse/deadlines.json（所有会话共享）
 * - v1.1: 多 Deadline 冲突检测 + AI 协商调度
 */
import { readFile, writeFile, rename, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";

export const name = "deadline-pulse";
export const inject = ["tools", "webServer"];

const FILE = "deadlines.json";
const DAY = 24 * 3600 * 1000;
const HOUR_MS = 3600 * 1000;

/**
 * 获取全局配置文件路径
 * Windows: C:\Users\<用户名>\.dsh\deadline-pulse\deadlines.json
 * macOS/Linux: ~/.dsh/deadline-pulse/deadlines.json
 */
function getGlobalFilePath() {
	// 使用 USERPROFILE (Windows) 或 HOME (macOS/Linux) 作为基础路径
	// 不使用 DSH_HOME，因为那是 DSH 应用目录，不是用户主目录
	const homeDir = process.env.USERPROFILE 
		|| process.env.HOME 
		|| (process.env.HOMEDRIVE + process.env.HOMEPATH)
		|| ".";
	return join(homeDir, ".dsh", "deadline-pulse", FILE);
}

/**
 * 确保配置目录存在
 */
async function ensureConfigDir() {
	const filePath = getGlobalFilePath();
	const dir = dirname(filePath);
	try {
		await mkdir(dir, { recursive: true });
	} catch (e) {
		// 目录可能已存在，忽略错误
	}
	return filePath;
}

/**
 * 时间格式规范化
 * 支持："2026-02-10", "2026-02-10 18:00", "2026-02-10T18:00:30", ISO 格式
 * 裸日期自动补全为当天 23:59:59
 */
function normalizeDue(input) {
	if (typeof input !== "string") return undefined;
	let s = input.trim();
	if (!s) return undefined;
	
	// 裸日期格式：YYYY-MM-DD
	if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
		s += "T23:59:59";
	} else {
		// 替换空格为 T
		s = s.replace(" ", "T");
	}
	
	const ms = Date.parse(s);
	if (!Number.isFinite(ms)) return undefined;
	
	const d = new Date(ms);
	const pad = (n) => String(n).padStart(2, "0");
	const text = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
	return { ms, text };
}

/**
 * 读取并验证存储文件
 * @returns {{ items?: unknown[], error?: string }}
 */
async function readStore(file) {
	let text;
	try {
		text = await readFile(file, "utf8");
	} catch (error) {
		if (error && (error.code === "ENOENT" || error.code === "ENOTDIR")) {
			return { items: [] };
		}
		return { error: `读取 ${FILE} 失败：${error.message}` };
	}
	
	if (!text.trim()) return { items: [] };
	
	let data;
	try {
		data = JSON.parse(text);
	} catch {
		return { error: `${FILE} 不是合法 JSON。请修复该文件后重试。` };
	}
	
	const arr = Array.isArray(data) ? data 
		: (data && Array.isArray(data.deadlines) ? data.deadlines : null);
	if (!arr) return { error: `${FILE} 结构不正确：需要 { "deadlines": [...] } 或顶层数组。` };
	
	const items = [];
	for (const raw of arr) {
		if (!raw || typeof raw !== "object") continue;
		if (typeof raw.title !== "string" || !raw.title.trim()) continue;
		items.push(raw);
	}
	return { items };
}

/**
 * 原子写入存储文件
 */
async function writeStore(file, items) {
	const tmp = file + ".tmp";
	await writeFile(tmp, `${JSON.stringify({ deadlines: items }, null, 2)}\n`, "utf8");
	await rename(tmp, file);
}

/**
 * 按标题查找条目（精确匹配优先，其次子串匹配）
 */
function findIndex(items, title) {
	const want = String(title).trim().toLowerCase();
	const exact = items.findIndex((it) => 
		typeof it.title === "string" && it.title.trim().toLowerCase() === want
	);
	if (exact >= 0) return exact;
	
	const hits = items.map((it, i) => 
		(typeof it.title === "string" && it.title.toLowerCase().includes(want)) ? i : -1
	).filter((i) => i >= 0);
	
	return hits.length === 1 ? hits[0] : -1;
}

/**
 * 工具输出 Schema
 */
const outputSchema = {
	type: "object",
	properties: {
		ok: { type: "boolean" },
		message: { type: "string" },
		deadlines: { type: "array", items: { type: "object", additionalProperties: true } },
		conflicts: { type: "array", items: { type: "object", additionalProperties: true } }
	},
	required: ["ok", "message"],
	additionalProperties: false
};

export function apply(ctx) {
	// 注册模型工具
	ctx.effect(() => ctx.tools.register({
		name: "deadline_tool",
		description: "Manage the user's deadlines (globally shared across all sessions). Actions: add (title and due required; optional tag, note, effort), list (show all), done (mark finished), remove (delete), conflicts (detect overlapping deadlines and suggest schedule), reschedule (change a deadline's due time). Use this whenever the user asks to remember, check, finish, delete, analyze conflicts, or reschedule a deadline.",
		parameters: {
			type: "object",
			properties: {
				action: { 
					type: "string", 
					enum: ["add", "list", "done", "remove", "conflicts", "reschedule"], 
					description: "Which operation to perform." 
				},
				title: { 
					type: "string", 
					description: "Deadline title. Required for add/reschedule; used to locate the item for done/remove." 
				},
				due: { 
					type: "string", 
					description: "Due time for add/reschedule, e.g. \"2026-02-10 18:00\" or \"2026-02-10\"." 
				},
				tag: { 
					type: "string", 
					description: "Optional short tag, e.g. 课程 / 工作." 
				},
				note: { 
					type: "string", 
					description: "Optional note." 
				},
				effort: { 
					type: "number", 
					description: "Estimated effort in hours (e.g. 3.5). Used for conflict detection." 
				}
			},
			required: ["action"],
			additionalProperties: false
		},
		output: {
			schema: outputSchema,
			render: (_args, value) => [{ type: "text", text: JSON.stringify(value) }]
		},
		async execute(args, exec) {
			const action = typeof args.action === "string" ? args.action : "";
			const file = await ensureConfigDir();
			
			try {
				const store = await readStore(file);
				if (store.error && !store.error.includes("不存在")) {
					return { ok: false, message: store.error };
				}
				const items = store.items || [];

				// 列出所有截止日期
				if (action === "list") {
					return { 
						ok: true, 
						message: items.length ? `共 ${items.length} 条截止日期。` : "当前没有记录任何截止日期。", 
						deadlines: items 
					};
				}

				// 添加截止日期
				if (action === "add") {
					const title = typeof args.title === "string" ? args.title.trim() : "";
					if (!title) return { ok: false, message: "add 需要 title（截止日期名称）。" };
					
					const due = normalizeDue(args.due);
					if (!due) return { ok: false, message: "add 需要有效的 due，例如 \"2026-02-10 18:00\" 或 \"2026-02-10\"。" };
					
					const item = { 
						title, 
						due: due.text, 
						done: false, 
						created: new Date().toISOString() 
					};
					if (typeof args.tag === "string" && args.tag.trim()) item.tag = args.tag.trim();
					if (typeof args.note === "string" && args.note.trim()) item.note = args.note.trim();
					if (typeof args.effort === "number" && args.effort > 0) item.effort = Math.round(args.effort * 10) / 10;
					
					const at = findIndex(items, title);
					if (at >= 0) items[at] = { ...items[at], ...item };
					else items.push(item);
					
					await writeStore(file, items);
					
					const left = due.ms - Date.now();
					const soon = left <= 0 
						? "（该时间已过，请确认）" 
						: left <= DAY 
							? "（不足一天，注意！）" 
							: "";
					
					return { 
						ok: true, 
						message: `已记录「${title}」，截止 ${due.text.replace("T", " ")}${soon}。所有会话的倒计时已同步。`, 
						deadlines: items 
					};
				}

				// 完成或删除
				if (action === "done" || action === "remove") {
					const title = typeof args.title === "string" ? args.title.trim() : "";
					if (!title) return { ok: false, message: `${action} 需要 title。` };
					
					const at = findIndex(items, title);
					if (at < 0) return { 
						ok: false, 
						message: `没有找到匹配「${title}」的截止日期。`, 
						deadlines: items 
					};
					
					const hit = items[at];
					if (action === "done") {
						items[at] = { ...hit, done: true };
						await writeStore(file, items);
						return { 
							ok: true, 
							message: `已把「${hit.title}」标记为完成。`, 
							deadlines: items 
						};
					}
					
					items.splice(at, 1);
					await writeStore(file, items);
					return { 
						ok: true, 
						message: `已删除「${hit.title}」。`, 
						deadlines: items 
					};
				}

				// 冲突检测
				if (action === "conflicts") {
					const active = items.filter(it => !it.done);
					if (active.length < 2) {
						return { 
							ok: true, 
							message: "当前只有 " + active.length + " 条未完成截止日期，无法检测冲突。", 
							deadlines: items,
							conflicts: [] 
						};
					}
					
					const conflicts = [];
					for (let i = 0; i < active.length; i++) {
						for (let j = i + 1; j < active.length; j++) {
							const a = active[i], b = active[j];
							const dueA = Date.parse(a.due), dueB = Date.parse(b.due);
							if (!Number.isFinite(dueA) || !Number.isFinite(dueB)) continue;
							
							const effortA = (typeof a.effort === "number" ? a.effort : 2) * HOUR_MS;
							const effortB = (typeof b.effort === "number" ? b.effort : 2) * HOUR_MS;
							
							// 准备窗口：从 due - effort 到 due
							const startA = dueA - effortA, endA = dueA;
							const startB = dueB - effortB, endB = dueB;
							
							// 窗口重叠检测
							const overlapStart = Math.max(startA, startB);
							const overlapEnd = Math.min(endA, endB);
							
							if (overlapStart < overlapEnd) {
								const overlapHours = Math.round((overlapEnd - overlapStart) / HOUR_MS * 10) / 10;
								
								// 同一天到期（即使准备窗口不重叠也算时间冲突）
								const sameDay = new Date(dueA).toDateString() === new Date(dueB).toDateString();
								
								conflicts.push({
									pair: [a.title, b.title],
									overlapHours,
									sameDay,
									dueA: a.due,
									dueB: b.due,
									effortA: typeof a.effort === "number" ? a.effort : null,
									effortB: typeof b.effort === "number" ? b.effort : null,
									severity: sameDay && overlapHours > 0 ? "high" 
										: overlapHours > 0 ? "medium" 
										: sameDay ? "low" : "none"
								});
							} else {
								// 准备窗口不重叠但同一天到期
								const sameDay = new Date(dueA).toDateString() === new Date(dueB).toDateString();
								if (sameDay) {
									conflicts.push({
										pair: [a.title, b.title],
										overlapHours: 0,
										sameDay: true,
										dueA: a.due,
										dueB: b.due,
										effortA: typeof a.effort === "number" ? a.effort : null,
										effortB: typeof b.effort === "number" ? b.effort : null,
										severity: "low"
									});
								}
							}
						}
					}
					
					const highConflicts = conflicts.filter(c => c.severity === "high");
					const medConflicts = conflicts.filter(c => c.severity === "medium");
					const lowConflicts = conflicts.filter(c => c.severity === "low");
					
					let msg = "";
					if (conflicts.length === 0) {
						msg = `✅ ${active.length} 条未完成截止日期之间没有检测到时间冲突。`;
					} else {
						const parts = [];
						if (highConflicts.length) parts.push(`🔴 ${highConflicts.length} 组高冲突（同日+准备窗口重叠）`);
						if (medConflicts.length) parts.push(`🟡 ${medConflicts.length} 组中冲突（准备窗口重叠）`);
						if (lowConflicts.length) parts.push(`🟢 ${lowConflicts.length} 组低冲突（同日到期）`);
						msg = `检测到 ${conflicts.length} 组冲突：${parts.join("；")}。建议对高冲突条目使用 reschedule 调整时间。`;
					}
					
					return { ok: true, message: msg, deadlines: items, conflicts };
				}

				// 重新调度
				if (action === "reschedule") {
					const title = typeof args.title === "string" ? args.title.trim() : "";
					if (!title) return { ok: false, message: "reschedule 需要 title。" };
					
					const newDue = normalizeDue(args.due);
					if (!newDue) return { ok: false, message: "reschedule 需要有效的新 due 时间。" };
					
					const at = findIndex(items, title);
					if (at < 0) return { 
						ok: false, 
						message: `没有找到匹配「${title}」的截止日期。`, 
						deadlines: items 
					};
					
					const oldDue = items[at].due;
					items[at] = { ...items[at], due: newDue.text };
					if (typeof args.effort === "number" && args.effort > 0) {
						items[at].effort = Math.round(args.effort * 10) / 10;
					}
					await writeStore(file, items);
					
					return { 
						ok: true, 
						message: `已将「${title}」从 ${oldDue.replace("T", " ")} 调整到 ${newDue.text.replace("T", " ")}。`, 
						deadlines: items 
					};
				}

				return { ok: false, message: `未知 action "${action}"，可用：add / list / done / remove / conflicts / reschedule。` };
			} catch (error) {
				return { ok: false, message: `deadline_tool 执行失败：${error.message}` };
			}
		}
	}), "deadline-pulse: tool");

	// 注册 Web API - 操作端点
	ctx.effect(() => ctx.webServer.register({
		path: "/api/deadline-pulse/action",
		method: "POST",
		async handler(req, res) {
			try {
				const body = await new Promise((resolve, reject) => {
					let data = "";
					req.on("data", chunk => data += chunk);
					req.on("end", () => {
						try { resolve(JSON.parse(data)); }
						catch (e) { reject(e); }
					});
					req.on("error", reject);
				});

				const { action, title, due, tag, note, effort } = body;
				const file = await ensureConfigDir();
				const store = await readStore(file);
				
				if (store.error && !store.error.includes("不存在")) {
					res.writeHead(400, { "Content-Type": "application/json" });
					res.end(JSON.stringify({ ok: false, message: store.error }));
					return;
				}

				const items = store.items || [];

				// 添加
				if (action === "add") {
					if (!title || !due) {
						res.writeHead(400, { "Content-Type": "application/json" });
						res.end(JSON.stringify({ ok: false, message: "add 需要 title 和 due" }));
						return;
					}
					const normalized = normalizeDue(due);
					if (!normalized) {
						res.writeHead(400, { "Content-Type": "application/json" });
						res.end(JSON.stringify({ ok: false, message: "无效的 due 格式" }));
						return;
					}
					const item = { 
						title: title.trim(), 
						due: normalized.text, 
						done: false, 
						created: new Date().toISOString() 
					};
					if (tag) item.tag = tag.trim();
					if (note) item.note = note.trim();
					if (typeof effort === "number" && effort > 0) item.effort = Math.round(effort * 10) / 10;
					
					const at = findIndex(items, title);
					if (at >= 0) items[at] = { ...items[at], ...item };
					else items.push(item);
					
					await writeStore(file, items);
					res.writeHead(200, { "Content-Type": "application/json" });
					res.end(JSON.stringify({ ok: true, message: `已记录「${title}」`, deadlines: items }));
					return;
				}

				// 完成或删除
				if (action === "done" || action === "remove") {
					if (!title) {
						res.writeHead(400, { "Content-Type": "application/json" });
						res.end(JSON.stringify({ ok: false, message: "需要 title" }));
						return;
					}
					const at = findIndex(items, title);
					if (at < 0) {
						res.writeHead(404, { "Content-Type": "application/json" });
						res.end(JSON.stringify({ ok: false, message: `没有找到「${title}」` }));
						return;
					}
					const hit = items[at];
					if (action === "done") {
						items[at] = { ...hit, done: true };
						await writeStore(file, items);
						res.writeHead(200, { "Content-Type": "application/json" });
						res.end(JSON.stringify({ ok: true, message: `已完成「${hit.title}」`, deadlines: items }));
						return;
					}
					items.splice(at, 1);
					await writeStore(file, items);
					res.writeHead(200, { "Content-Type": "application/json" });
					res.end(JSON.stringify({ ok: true, message: `已删除「${hit.title}」`, deadlines: items }));
					return;
				}

				// 冲突检测
				if (action === "conflicts") {
					const active = items.filter(it => !it.done);
					const conflicts = [];
					for (let i = 0; i < active.length; i++) {
						for (let j = i + 1; j < active.length; j++) {
							const a = active[i], b = active[j];
							const dueA = Date.parse(a.due), dueB = Date.parse(b.due);
							if (!Number.isFinite(dueA) || !Number.isFinite(dueB)) continue;
							const effortA = (typeof a.effort === "number" ? a.effort : 2) * HOUR_MS;
							const effortB = (typeof b.effort === "number" ? b.effort : 2) * HOUR_MS;
							const startA = dueA - effortA, endA = dueA;
							const startB = dueB - effortB, endB = dueB;
							const overlapStart = Math.max(startA, startB);
							const overlapEnd = Math.min(endA, endB);
							const sameDay = new Date(dueA).toDateString() === new Date(dueB).toDateString();
							if (overlapStart < overlapEnd) {
								const overlapHours = Math.round((overlapEnd - overlapStart) / HOUR_MS * 10) / 10;
								conflicts.push({ pair: [a.title, b.title], overlapHours, sameDay, severity: sameDay && overlapHours > 0 ? "high" : overlapHours > 0 ? "medium" : sameDay ? "low" : "none", dueA: a.due, dueB: b.due, effortA: typeof a.effort === "number" ? a.effort : null, effortB: typeof b.effort === "number" ? b.effort : null });
							} else if (sameDay) {
								conflicts.push({ pair: [a.title, b.title], overlapHours: 0, sameDay: true, severity: "low", dueA: a.due, dueB: b.due, effortA: typeof a.effort === "number" ? a.effort : null, effortB: typeof b.effort === "number" ? b.effort : null });
							}
						}
					}
					res.writeHead(200, { "Content-Type": "application/json" });
					res.end(JSON.stringify({ ok: true, conflicts, deadlines: items }));
					return;
				}

				// 重新调度
				if (action === "reschedule") {
					if (!title || !due) {
						res.writeHead(400, { "Content-Type": "application/json" });
						res.end(JSON.stringify({ ok: false, message: "reschedule 需要 title 和新的 due" }));
						return;
					}
					const normalized = normalizeDue(due);
					if (!normalized) {
						res.writeHead(400, { "Content-Type": "application/json" });
						res.end(JSON.stringify({ ok: false, message: "无效的 due 格式" }));
						return;
					}
					const at = findIndex(items, title);
					if (at < 0) {
						res.writeHead(404, { "Content-Type": "application/json" });
						res.end(JSON.stringify({ ok: false, message: `没有找到「${title}」` }));
						return;
					}
					items[at] = { ...items[at], due: normalized.text };
					if (typeof effort === "number" && effort > 0) items[at].effort = Math.round(effort * 10) / 10;
					await writeStore(file, items);
					res.writeHead(200, { "Content-Type": "application/json" });
					res.end(JSON.stringify({ ok: true, message: `已将「${title}」调整到 ${normalized.text.replace("T", " ")}`, deadlines: items }));
					return;
				}

				res.writeHead(400, { "Content-Type": "application/json" });
				res.end(JSON.stringify({ ok: false, message: `未知 action: ${action}` }));
			} catch (error) {
				res.writeHead(500, { "Content-Type": "application/json" });
				res.end(JSON.stringify({ ok: false, message: `服务器错误：${error.message}` }));
			}
		}
	}), "deadline-pulse: web-api");

	// 注册 Web API - 读取端点
	ctx.effect(() => ctx.webServer.register({
		path: "/api/deadline-pulse/list",
		method: "GET",
		async handler(req, res) {
			try {
				const file = await ensureConfigDir();
				const store = await readStore(file);
				
				if (store.error && !store.error.includes("不存在")) {
					res.writeHead(400, { "Content-Type": "application/json" });
					res.end(JSON.stringify({ ok: false, message: store.error }));
					return;
				}
				
				res.writeHead(200, { "Content-Type": "application/json" });
				res.end(JSON.stringify({ ok: true, deadlines: store.items || [] }));
			} catch (error) {
				console.error('[deadline-pulse] GET error:', error);
				res.writeHead(500, { "Content-Type": "application/json" });
				res.end(JSON.stringify({ ok: false, message: `服务器错误：${error.message}` }));
			}
		}
	}), "deadline-pulse: web-api-read");
}
