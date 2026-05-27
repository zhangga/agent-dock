# 首启体验优化

目标：让用户运行 `npm run dev` / `npx agentdock` 后，无需任何点击即可开始把已安装 skill 加到 backup，并在首屏给出可关闭的 3 步入门提示。

## 改动一：自动创建默认 backup file

去掉首次启动时"手动点 Create backup file 才能开始保存 skill"的摩擦。

设计要点：
- 只在 CLI 启动服务器这一条入口触发，不放进 `createAgentDockServer()`，避免污染 server 测试契约。
- `status` / `diagnostics` / `profile` 子命令保持只读，不会因此开始悄悄写文件。
- 幂等：文件已存在时跳过，不存在才写入空 stack。
- 写失败（权限/磁盘）不阻止服务器启动，仅打印 warning，UI 仍会显示"Create backup file"让用户手动重试。

涉及文件：
- `src/cli/startup.ts`（新增）：导出 `ensureDefaultStackFile()`，签名 `(options?: { configPath?; stackPath? }) => Promise<{ path; created; error? }>`。路径解析顺序：`options.stackPath` → `readAgentDockConfig().stackPath` → `getDefaultStackPath()`。
- `src/cli/index.ts`：`startServer()` 启动前 `await ensureDefaultStackFile()`；`created === true` 时打印 `Backup file ready at <path>`，`error` 时打印 warning。
- `tests/cli/startup.test.ts`（新增）：4 个用例覆盖缺失时创建、已存在不覆盖、`configPath` 解析、写失败返回 error 不抛异常。

## 改动二：首屏 3 步入门卡片

让新用户在首屏一眼看清 AgentDock 的核心三步流程：本机 skills → 加入 Backup → 换电脑恢复。

设计要点：
- 复用现有 `#next-step` 卡片的位置和样式，但作为更高优先级的独立状态，不和 `getNextStep()` 状态机互相干扰。
- 显示规则：`localStorage["agentdock.onboarding.v1"] !== "dismissed"` 时显示 onboarding，否则交回 `getNextStep()`。
- dismiss key 带 `v1` 版本，未来内容大改时升 `v2` 可以让老用户再看一次。
- localStorage 不可用（隐私模式）时静默忽略，每次访问都会再显示，但不影响功能。

文案：

```
Welcome
How AgentDock works

1. Browse the skills installed on this machine
2. Save the ones you want to keep in Backup
3. Restore them on another machine anytime

[Got it]
```

涉及文件：
- `src/ui/page.ts`：
  - `.next-step-body` 加 `white-space: pre-line` 让 `\n` 排版生效。
  - script 顶部加 `ONBOARDING_KEY = "agentdock.onboarding.v1"` 和 `readOnboardingDismissed()` / `persistOnboardingDismissed()` 工具函数（try/catch 包住 localStorage 调用）。
  - state 新增 `onboardingDismissed: readOnboardingDismissed()`。
  - `renderNextStep(installed)` 顶部插入 onboarding 分支。
  - `handleNextStepAction(action)` 增加 `dismiss-onboarding` 分支：写 localStorage、更新 state、`render()`。
- `tests/server/server.test.ts`：新增 HTML 字符串断言，覆盖 `id="next-step"`、`agentdock.onboarding.v1`、`How AgentDock works`、`dismiss-onboarding`、`readOnboardingDismissed(`、`persistOnboardingDismissed(`。

## 不需要改动

- `src/core/stackStore.ts` / `src/core/configStore.ts`：复用现有函数。
- `src/server/server.ts` / `src/server/listen.ts`：保持不变，server 仍是无文件副作用的纯响应器。
- 现有 `tests/server/server.test.ts` "serves an empty stack as JSON"：因为只调用 `createAgentDockServer()`，未经过 `startServer()`，无需修改。

## 验证

1. 自动创建：删除 `~/.agentdock/stack.json` 后 `npm run dev`，终端打印 `Backup file ready at <path>`，文件已生成。
2. 幂等：再次 `npm run dev`，不再打印 `Backup file ready`，文件 mtime 不变。
3. 首屏卡片：隐身窗口打开 `http://127.0.0.1:3789` 看到 "How AgentDock works" + 3 步说明 + "Got it"；点击后切回正常 next-step 逻辑；刷新不再显示；清空 localStorage 后再次显示。
4. CLI 只读子命令：删除 stack 后 `npm run dev -- status` / `-- diagnostics`，文件不被自动创建。
5. 自动测试：`npm test` 全部通过（`tests/core/diagnostics.test.ts` 中 `reports ok checks when restore prerequisites are available` 是 main 上已存在的失败，与本次改动无关）；`npm run build` 干净通过。
