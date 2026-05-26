# AgentDock

AgentDock 是一个本地 Agent 能力管理工具。当前 MVP 先支持查看本机已经安装的 skills。

## MVP 功能

- 扫描本机 skill 目录中的 `SKILL.md`。
- 解析 skill 名称、描述、安装路径和来源位置。
- 提供本地 Web 控制台查看 installed skills。
- 用 `Location` 显示 skill 来自 `Personal`、`Codex`、`Project` 或 `Custom`。
- 将已安装 skill 加入备份文件。
- 在备份内容中查看当前机器上是 `Installed` 还是 `Missing`。
- 加入备份前确认可迁移安装命令，能从 skills.sh 找到时自动预填。
- 根据备份文件生成 `Restore Preview`，区分已安装、可恢复和需要处理的 skills。
- 在界面中点击 `Start restore` 恢复可安装的缺失 skills。
- 在 `Restore` 页运行 `Diagnostics`，检查恢复所需的本地工具、网络、备份文件和 skill 目录权限。
- 对缺少安装来源的 skill 手动补充 `npx skills add ...` 安装命令。
- 保留 `Copy install script` 作为高级备用入口。
- 卸载当前机器上的 skill，本机 agent 链接优先交给 `npx skills remove` 处理，同时保留 Backup 中的长期保留记录。
- 从备份文件中移除不想长期保留的 skill。
- 在界面中创建或切换当前备份文件。
- 提供 `status` 命令在终端查看 installed skills。

默认扫描路径：

- `~/.agents/skills`
- `~/.codex/skills`
- `~/.claude/skills`
- 当前项目下的 `.agents/skills`
- 当前项目下的 `.codex/skills`
- 当前项目下的 `.claude/skills`

也可以用 `AGENTDOCK_SKILL_DIRS` 或 `--skill-root` 指定扫描目录。

备份文件默认保存到：

```text
~/.agentdock/stack.json
```

这个文件记录用户想长期保留和迁移的 skills。主界面会显示当前使用的备份文件路径；如果文件还不存在，可以在界面中点击 `Create backup file` 创建。

如果想把备份文件放到别的位置，在主界面的 `Current backup file` 区域点击 `Choose backup file...`，通过系统文件选择器选择或创建 JSON 文件。文件选择器不可用时，可以点击 `Enter path manually` 手动输入路径。文件创建后，可以点击 `Show file` 在系统文件管理器中定位备份文件，或点击 `Copy path` 复制路径，再用自己喜欢的同步方式传到另一台电脑。

当前版本的备份文件只保存迁移所需的期望状态，不保存本机路径、描述、扫描结果或解析时间。保存 skill 前会先尝试把来源解析成结构化的 skills.sh source；如果找不到，可以手动补充 `npx skills add ...` 安装命令，也可以直接粘贴 GitHub 上 `skills/{skill-name}` 目录的链接，确认后才会写入备份。

示例：

```json
{
  "schemaVersion": 1,
  "skills": [
    {
      "id": "find-skills",
      "type": "skill",
      "source": {
        "type": "skills.sh",
        "package": "vercel-labs/skills",
        "skill": "find-skills"
      },
      "desiredState": "enabled"
    }
  ]
}
```

换电脑时，旧机器先把想长期保留的 skills 加入备份文件。点击 `Add to backup` 后，AgentDock 会先确认安装命令：能自动找到就预填，找不到就粘贴 `npx skills add ...` 命令或 GitHub skill 目录链接，例如 `https://github.com/zhangga/aihub/tree/main/skills/chatgpt-images-fallback`。新机器运行 AgentDock 后，在主界面点击 `Choose backup file...` 选择这个 JSON 文件。`Restore Preview` 会自动分成已安装、可恢复和需要处理三类；点击 `Start restore` 后，AgentDock 会在本机执行可恢复 skills 的安装命令。`Copy install script` 仍作为高级备用方式保留。

恢复前或恢复失败后，可以在 `Restore` 页点击 `Run diagnostics`。AgentDock 会检查 Node.js、npm、npx、git、GitHub、skills.sh、当前备份文件读写状态，以及至少一个 skill root 是否可写，并用 `ok`、`warning` 或 `error` 标出需要处理的项。

如果只是想清理当前电脑上的某个 skill，可以在 `Installed` 页点击 `Uninstall`。AgentDock 会优先调用 `npx skills remove` 清理同一作用域下的 agent 安装；如果无法通过 CLI 完成，会回退到安全删除当前扫描到的本地副本。这个操作不会从 Backup 里移除记录，之后仍可在 `Restore` 页重新安装。

如果配置了 skills.sh API key，可以让解析更稳定：

```bash
SKILLS_SH_API_KEY=sk_live_xxx npm run dev
```

未配置 API key 时，AgentDock 会 fallback 到 `npx skills find <skill>` 的公开搜索结果。

## 开发运行

```bash
npm install
npm run dev
```

打开：

```text
http://127.0.0.1:3789
```

只看终端状态：

```bash
npm run dev -- status
```

指定 skill 目录：

```bash
npm run dev -- --skill-root /path/to/skills
npm run dev -- status --skill-root /path/to/skills
```

如果 `3789` 端口被占用，可以先查看占用进程：

```bash
lsof -nP -iTCP:3789 -sTCP:LISTEN
```

关闭占用进程：

```bash
lsof -ti tcp:3789 | xargs kill
```

也可以直接换一个端口启动：

```bash
npm run dev -- --port 3790
```

## 验证

```bash
npm test
npm run build
```
