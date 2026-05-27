# AgentDock 用户体验优化计划

目标：对普通用户优化，开箱即上手、零学习成本。

下面按"用户从点开到完成任务"的真实路径梳理摩擦点和对应优化，标记优先级和当前实现状态。

## 当前用户旅程的核心矛盾

文档目标用户是"不想理解 client / 目录 / 配置差异的普通用户"，但实操路径上仍要求他们：

1. 知道 npx / Node ≥ 20 / 命令行
2. 理解 Backup file / Stack / Profile 三个新概念之间的区别
3. 接受四个 Tab：Installed / Backup / Restore + 隐藏的 Backup tools / Restore tools
4. 在 Add to backup 时手动输入或确认 `npx skills add ...` 命令
5. 在新机器上手动选 backup file 路径

文档第 4.5 节强调"desired state 优先"，但 UI 上 Backup 仍是必须显式构建的列表，这是和"零学习成本"目标最大的冲突。

---

## P0：首次启动体验（用户第一眼看到什么）

### 1. 自动创建默认 backup file ✅ 已实现

| 现状 | 问题 | 建议 |
|---|---|---|
| `next-step` 卡片首次显示 "Create a backup file" 让用户主动点 | backup file 是工具内部状态，不该当"项目要不要创建"的选择来面对 | 首次启动直接在 `~/.agentdock/stack.json` 自动 createStack，UI 不暴露 Create backup file 按钮，只在路径变更时提示 |

实现细节见 `docs/onboarding-ux-improvements.zh.md`。

### 5. 首屏 3 步上手卡片 ✅ 已实现

| 现状 | 问题 | 建议 |
|---|---|---|
| 启动后默认在 Installed Tab，主区域空着 + status line "Scanning..." | 用户看不出"这工具能帮我做什么" | 顶部加 30 秒入门提示卡（首次出现，可关）：3 步"看本机 skills → 加入 Backup → 换电脑恢复" |

实现细节见 `docs/onboarding-ux-improvements.zh.md`。

### 侧栏 metric 重构 ⏳ 待办

| 现状 | 问题 | 建议 |
|---|---|---|
| 侧栏三个 metric 数字（installed / source roots / in backup）冷冰冰 | source roots 对普通用户没意义 | 把 source roots 换成更有用的 missing to restore，或合并到 stack-file 区块 |

### Dark mode ⏳ 待办

| 现状 | 问题 | 建议 |
|---|---|---|
| 没有 dark mode | 一些用户在深色 IDE 里跳过来眼睛会被白底刺到 | 用 `@media (prefers-color-scheme: dark)` 适配，复用 CSS 变量很便宜 |

---

## P0：核心概念命名（认知负担） ⏳ 待办

README 同时出现 Stack / Backup / Profile / Restore source / Install command 五个术语，UI 里 Backup tools 又塞了 Add by source / Update Check / Profile Sync 三件事，新用户分不清谁是谁。

建议合并/重命名：

- Backup file → My Skills（用户长期清单，对应文档里的 My Stack）
- Profile → Shareable export 或干脆叫 Export file
- Add by source → Add a skill I don't have yet
- 侧栏 caption Skills backup and restore → Keep your skills, move them anywhere

> 这一条建议先收意见，因为术语统一一旦改了影响测试和文档。

---

## P0：Backup 流程的强制确认弹窗 ⏳ 待办

`add-to-backup` 按钮 → 调用 `/api/stack/skills/resolve` → 弹出 `backup-confirm-dialog`，要求用户确认或输入 `npx skills add ...` 命令。

对于 skills.sh 能解析到来源的常见情形（大多数），弹窗只是"看一眼然后点确定"，是无意义的摩擦。

建议：

- **能解析到来源时**：直接保存，status line 提示 Saved（review source），把弹窗替换为可撤销的轻提示（Saved · Edit source · Undo）
- **解析失败时**：才弹窗或在 Installed Tab 该行内联展开输入框（不全局 modal）
- 弹窗里 `npx skills add https://github.com/owner/repo --skill skill-name` 的 placeholder 太长，新用户看不懂格式——加迷你示例 + "Paste a GitHub link to a skill folder, like https://github.com/.../skills/my-skill"

---

## P1：新机器恢复流程 ⏳ 待办

当前路径：用户启动 → 主界面 Installed → 点 Choose backup file 改路径 → 切到 Restore Tab → 点 Start restore。

问题：

- 用户拿到 JSON 文件后，没有任何引导告诉他"先选这个文件"
- `next-step` 卡片在 stackFile 不存在时只提示 Create a backup file，对恢复场景没帮助

建议：

- 启动时如果检测到当前目录或 Downloads 下有 `agentdock-profile.json` / `agentdock-stack.json`，在 next-step 弹"看起来你想恢复，要不要用这个文件？"
- 支持启动命令 `npx agentdock --from <path>` 一步进入恢复模式
- 让 Choose backup file 入口在"backup file 不存在或为空"时更醒目（不要藏在 details 里）
- Restore Tab 的 Restorable 卡片现在只是个数字，应默认展开每条，列出名字和来源——用户第一次看不到清单内容会迟疑

---

## P1：错误消息与下一步建议 ⏳ 待办

很多 catch 分支只把 status line 设成 `payload.error || "Could not xxx"`：Scan failed、Could not export profile、Could not check restore source 等。

文档第 9.9 节明确写："错误信息应面向普通用户，尽量给出下一步操作建议"，现状不达标。

建议：把错误 toast/状态行升级成结构化的 `{title, hint, action?}`：

```
Scan failed
   Most likely the skill root isn't readable.
   [Run diagnostics]  [Retry]
```

---

## P1：CLI 体验 ⏳ 待办

- `agentdock --help` 全英文，README 全中文——首次面对中文用户的二次摩擦
- 没有进度反馈：`agentdock` 启动时打印一行就完了，restore / diagnostics 用 CLI 时也没有提示
- `profile export` 输出到 stdout 是 JSON，普通用户复制粘贴时会带上 shell prompt
- 加 `agentdock doctor` 别名指向 diagnostics（更直觉），并在 status 命令最后加一行 "Open the console at http://..." 提示

---

## P2：UI 细节 ⏳ 待办

- **搜索框只在 Installed Tab 可见**，但 Backup 里有 20 条时同样需要过滤——把 search 提到全局或在每个 Tab 都给一份
- **Installed 表格 5 列**（Name / Description / Location / Install path / Backup），install path 占了大量横向空间——默认折叠成 hover 显示
- 描述用 `<details>` 切换有点重，普通用户不会点开看；建议直接 truncate + tooltip
- "Show uninstall" 这种"先开开关再操作"的二段式设计反直觉。卸载是低频操作，可以放进每行的 `...` 菜单
- 移动端（390px）表格转成 `data-label` 卡片已经做了，但 dialog 在窄屏里宽度处理可以再看一眼

---

## P2：诊断的发现性 ⏳ 待办

Diagnostics 在 Restore Tab 的 Advanced section 下，但最常见的失败场景就是 Node / npx 缺失或网络不通——应该：

- 启动时自动跑一次诊断（只跑本地 + 离线检查），有 error 时在主界面顶部红条提示
- 不要让用户失败一次才去翻 advanced 找 diagnostics

---

## P2：Profile 的双框 UI ⏳ 待办

Backup tools 里 Export + Import 是两个并排的 textarea + 一堆按钮，信息密度过高，对不知道 profile 是什么的用户是直接劝退。

建议：

- 改成单一行动 Share with another computer，下方两个简单选项：导出（一键复制 / 一键下载 .json）/ 导入（粘贴或选择文件）
- 导入和 backup file 选择应统一入口，因为对用户来说都是"我拿到一个文件，把它装到这台机器"

---

## 落地优先级（推荐顺序）

1. ✅ 自动创建默认 backup file
2. ⏳ 重命名核心术语，让侧栏和 Tab 名称对普通用户友好
3. ⏳ 简化 add-to-backup：能解析就直接保存 + 可撤销，失败才提示
4. ⏳ 新机器引导：自动探测 stack/profile 文件 + 显著的"我要恢复"入口
5. ✅ 首屏 3 步上手卡片（可关）
6. ⏳ 首启动自动诊断 + 失败时红条提示
7. ⏳ 错误信息升级为带 hint+action 的结构
8. ⏳ Dark mode
