# AgentDock 产品需求与设计草案

## 1. 问题定义

Agent 能力组件正在变多，包括 skills、MCP servers、plugins、prompts、工作流模板和 client 配置。用户真正需要解决的不是“怎么理解某个仓库结构”，而是下面几个问题：

- 当前机器到底安装了哪些 Agent 能力组件？
- 哪些组件有新版本、异常状态或缺失依赖？
- 哪些组件应该启用，哪些应该临时禁用或卸载？
- 遇到好用组件时，如何记录到自己的长期清单？
- 换一台电脑时，如何快速恢复自己需要的一组能力？

从第一性原理看，AgentDock 应管理三类状态：

- **本机真实状态**：当前机器和当前项目中实际安装、配置、启用的组件。
- **可用组件目录**：用户可以发现、安装、更新的组件来源。
- **用户期望状态**：用户长期想保留和迁移的能力清单，也就是 My Stack。

AgentDock 的核心价值是把这三类状态对齐：扫描真实状态，展示可用选择，维护期望清单，并通过可确认的操作计划把机器调整到用户想要的状态。

## 2. 产品定位

`AgentDock` 是一个本地 Agent 能力管理工具，用来查看、安装、更新、禁用、卸载、保存和迁移当前机器上的 Agent 能力组件。

第一阶段重点覆盖：

- Skills
- MCP servers
- Plugins 的扫描、展示和保存
- My Stack / Saved Components
- Profile 导入导出

后续可扩展覆盖：

- Plugins 的完整安装、更新、启用 / 禁用和卸载闭环
- Prompts
- Agent client 配置管理
- 工作流模板
- 团队共享 stack
- 远程同步

AgentDock 的第一版不应被任何既有仓库、脚本或发布流程绑定。它应以清晰的数据模型、组件适配器和 plan/apply 执行模型为核心，允许未来接入不同组件来源。

## 3. 目标用户

### 普通用户

想使用 Agent 能力，但不想理解各个工具、client、目录和配置文件之间的差异。

典型需求：

- 我当前装了哪些 skills、MCP servers 和 plugins？
- 有没有可以更新的？
- 我想临时禁用或卸载一些不常用组件。
- 我遇到好用的 skill / MCP / plugin，想先记录下来，之后换电脑也能快速安装。
- 我换了一台电脑，想恢复原来的能力组合。

### 高级用户

熟悉 CLI，但希望用统一模型管理不同 client 和不同安装范围。

典型需求：

- 区分全局安装、项目安装和 client 级启用。
- 导入导出自己的组件清单。
- 检查本机环境是否满足运行要求。
- 查看安装失败原因、执行计划和日志。
- 手动调整 profile 或 stack 文件。

### 组件维护者

希望自己的组件能被用户发现、安装、更新和保存。

典型需求：

- 提供机器可读的组件元数据。
- 描述安装、更新、禁用、卸载所需动作。
- 声明支持的 client、平台、依赖和环境变量。
- 避免让用户直接理解底层命令细节。

## 4. 设计原则

### 4.1 本机优先

AgentDock 要解决的是本机能力管理问题。第一版应运行在用户机器上，直接扫描文件系统、读取 client 配置，并在用户确认后执行本地操作。

### 4.2 Desired State 优先

安装过什么不是最重要的，用户长期想带走什么才重要。My Stack 是用户的期望状态；当前机器状态只是某一次落地结果。

### 4.3 先 plan，后 apply

所有会修改本机状态的操作都必须先生成计划，展示影响范围、文件变化、命令摘要、风险和回滚建议。用户确认后才能执行。

### 4.4 适配器隔离复杂度

不同组件类型、client 和平台差异应封装在 adapter 中。核心系统只理解统一的组件模型、状态模型、计划模型和日志模型。

### 4.5 不保存密钥

Profile、My Stack 和日志可以保存需要哪些环境变量，但不能保存 API key、token、password 等敏感值。

### 4.6 可降级

如果某类组件暂不支持自动安装、更新、禁用或卸载，AgentDock 仍应能展示状态、保存到 My Stack，并给出手动操作建议。

## 5. 产品形态

第一版推荐采用：

> 本地 Web 控制台 + CLI 后端

用户运行：

```bash
npx agentdock
```

随后自动打开本地页面，例如：

```text
http://localhost:3789
```

CLI 后端负责：

- 扫描本机安装状态。
- 读取全局、项目级和 client 级配置。
- 拉取或读取组件目录 manifest。
- 计算可安装、已安装、可更新、已禁用、异常等状态。
- 生成安装、更新、启用、禁用、卸载、导入、导出的操作计划。
- 在用户确认后执行操作计划。
- 维护 My Stack。
- 记录和展示操作日志。

Web UI 负责：

- 展示当前机器状态。
- 提供搜索、筛选、安装、更新、启用 / 禁用、卸载、导入、导出。
- 支持将组件保存到 My Stack。
- 展示执行前确认和执行后结果。
- 降低普通用户理解成本。

### 为什么不先做纯在线 Web

纯在线 Web 无法可靠扫描本机目录，也无法直接修改本地 client 配置。它适合作为公开目录或文档站，但不适合作为第一阶段的主产品。

### 为什么不先做完整桌面 App

桌面 App 可以带来更完整体验，但会引入安装包、签名、自动更新、权限和跨平台构建成本。第一版先用本地 Web 验证核心流程，后续可用 Tauri 或 Electron 包装。

## 6. 核心目标

1. 让用户知道当前机器安装了什么。
2. 让用户知道哪些组件可以更新。
3. 让用户快速安装需要的组件。
4. 让用户可以卸载或禁用暂时不需要的组件。
5. 让用户保存自己长期需要的能力清单，而不只是在当前机器上安装一次。
6. 让用户把一台机器上的能力组合迁移到另一台机器。
7. 用统一模型屏蔽不同组件类型、client 和平台差异。

## 7. 非目标

第一版暂不做：

- 账号系统。
- 云同步。
- 支付、评分、评论等 marketplace 能力。
- 完整桌面 App。
- 复杂权限系统。
- 将密钥或敏感环境变量写入 profile 或 My Stack。
- 完整 plugin marketplace、签名、评分和运行时生态。
- 对所有 client 的完整自动改写能力。

第一版可以支持 plugins 的基础扫描、展示和保存到 My Stack；但不要求所有 plugin 都具备完整的一键安装、更新、启用 / 禁用和卸载闭环。第一版可以预留 prompts 的数据结构，但不强求完整管理闭环。

## 8. 核心概念模型

### 8.1 Component

Component 是 AgentDock 管理的最小能力单元。

字段包括：

- `id`：稳定标识。
- `type`：`skill`、`mcp`、`plugin`、`prompt`。
- `name`：展示名称。
- `description`：组件说明。
- `source`：来源信息，可以是 URL、包名、本地路径或内置目录来源。
- `version`：版本、commit、content hash 或 manifest revision。
- `tags`：用途标签。
- `supportedScopes`：支持 global、project、client 中哪些范围。
- `supportedClients`：支持哪些 Agent client。
- `requiredEnv`：需要哪些环境变量名称。
- `capabilities`：是否支持 install、update、enable、disable、uninstall、saveOnly。

### 8.2 Inventory

Inventory 是本机真实状态。

字段包括：

- 已安装组件。
- 安装范围：global、project、client。
- 当前版本或 hash。
- 当前启用状态。
- 所属 client。
- 本地路径或配置位置。
- 错误、未知或缺失依赖状态。

### 8.3 Catalog

Catalog 是可用组件目录。

来源可以是：

- 远端 manifest URL。
- 本地 manifest 文件。
- 内置推荐源。
- 用户手动添加的组件定义。

Catalog 不等于已安装状态，也不等于 My Stack。它只回答“有哪些组件可被发现和管理”。

### 8.4 My Stack

My Stack 是用户长期想保留和迁移的能力清单，不等同于当前机器所有已安装组件。

My Stack 应尽量小，只表达“用户想要什么”。当前机器上的安装路径、扫描状态、描述文本、解析时间和其他临时信息应由 Inventory 在运行时提供，不写入同步文件。

My Stack 可以包含：

- 已安装且想迁移的组件。
- 当前未安装但想记录的组件。
- 推荐 bundle。
- 首选安装范围。
- 期望启用状态。
- 需要的环境变量名称。

### 8.5 Profile

Profile 是可导入导出的迁移文件。

Profile 可以包含：

- My Stack。
- 当前机器安装快照。
- 安装范围偏好。
- 期望启用状态。
- 所需环境变量名称。
- 导出时间和 AgentDock 版本。

Profile 不应包含密钥值和不必要的本机私有路径。

### 8.6 Plan

Plan 是所有修改操作的中间表示。

Plan 应包含：

- 将要安装、更新、启用、禁用、卸载或保存的组件。
- 影响范围：global、project、client。
- 将修改的文件或配置。
- 将执行的命令或等价操作摘要。
- 需要用户补充的环境变量。
- 风险提示。
- 回滚或恢复建议。

## 9. 第一版功能范围

### 9.1 Dashboard

展示当前机器的总体状态：

- 已安装 skills 数量。
- 已安装 MCP servers 数量。
- 已安装 plugins 数量。
- 可更新组件数量。
- 已禁用组件数量。
- 安装异常或无法识别的组件数量。
- My Stack 中保存的组件数量。
- 当前项目路径。
- 全局配置路径。
- 最近一次检查更新时间。

组件状态至少包括：

- `installed`
- `not_installed`
- `update_available`
- `disabled`
- `unknown`
- `error`

### 9.2 Inventory

展示当前机器真实安装状态。

功能：

- 按类型筛选：skill、mcp、plugin、prompt。
- 按范围筛选：global、project、client。
- 按 client 筛选。
- 查看版本、来源、路径和状态。
- 查看是否已保存到 My Stack。
- 查看错误原因和建议操作。

### 9.3 Catalog

展示 AgentDock 可管理的组件目录。

功能：

- 按名称搜索。
- 按类型筛选。
- 按标签或用途筛选。
- 按 client 支持情况筛选。
- 显示组件描述。
- 显示来源和安装范围支持情况。
- 显示本地状态：未安装、已安装、可更新、已禁用、异常。
- 显示是否已保存到 My Stack。
- 支持将未安装或已安装组件保存到 My Stack。

### 9.4 Install

支持安装：

- 单个 skill。
- 单个 MCP server。
- 单个 plugin（当 manifest 或 adapter 提供可靠安装动作时）。
- 一个 bundle。
- My Stack 中保存的一组组件。

安装范围：

- 全局安装。
- 当前项目安装。
- 指定 client 安装或启用。

安装前必须展示：

- 将要安装的组件。
- 安装目标范围。
- 将要执行的命令或等价操作摘要。
- 将要修改的配置文件。
- 可能需要用户补充的环境变量。

安装后展示：

- 成功列表。
- 失败列表。
- 日志摘要。
- 下一步建议。

如果某类组件暂时没有安全的一键安装 adapter，AgentDock 应展示可执行命令、缺失前置条件和手动下一步，而不是静默失败。

### 9.5 Update

支持更新检测和更新执行。

功能：

- 拉取或读取组件 manifest。
- 对比本地版本和可用版本。
- 显示可更新组件。
- 支持单个更新。
- 支持批量更新。
- 更新前展示影响范围。
- 更新后展示结果和日志。

版本对比可以基于 semver、source hash、content hash、commit、manifest revision 或 adapter 自定义策略。不同组件类型可以有不同的版本识别策略。

对于暂时不支持自动更新的组件，AgentDock 仍应展示可更新状态，并提供建议命令或手动更新说明。

### 9.6 Enable / Disable / Uninstall

支持对组件进行启用、禁用和卸载。

功能：

- 查看组件当前是否启用。
- 禁用已安装组件，保留文件和元数据，但不让其在目标范围内生效。
- 重新启用已禁用组件。
- 卸载组件，并在操作前展示将删除或修改的内容。
- 区分全局、当前项目和指定 client 的影响范围。
- 对不支持安全禁用或卸载的组件，展示原因和手动处理建议。

概念区分：

- `disable`：保留安装记录，适合临时不使用、排查问题或减少 client 加载项。
- `uninstall`：移除本机安装，适合不再需要或需要彻底清理。
- `remove from My Stack`：只从用户长期清单移除，不一定影响当前机器安装状态。

### 9.7 My Stack / Saved Components

My Stack 是用户长期想保留和迁移的 Agent 能力清单。

支持：

- 将 catalog 中的组件保存到 My Stack，即使当前机器暂未安装。
- 安装组件时选择是否同时保存到 My Stack。
- 从 Inventory 中把已安装组件加入 My Stack。
- 从 My Stack 中移除组件。
- 查看 My Stack 中哪些组件当前已安装、缺失、可更新或安装失败。
- 保存 skill 时尽量解析 skills.sh 来源，写入结构化来源而不是完整本机状态。
- 无法从 skills.sh 或其他来源解析安装来源时，将 source 标记为 `unknown`。
- 查看当前使用的 My Stack 文件位置。
- 在界面中通过系统文件选择器创建或切换 My Stack 文件位置。
- 文件选择器不可用时，提供手动输入路径的 fallback。
- 用 My Stack 在新机器上一键生成安装计划。
- 根据当前机器状态把 My Stack 分成已安装、可安装和缺少安装来源，并生成可复制安装脚本。
- 从 My Stack 导出 profile。

My Stack 应记录：

- 组件 id 和类型。
- 可迁移来源，例如 skills.sh package 和 skill 名称。
- 必要时的手动安装命令 fallback。
- 版本、hash 或版本约束。
- 推荐安装范围：global、project 或 client。
- 期望启用状态。
- bundle 信息。
- 需要的环境变量名称，但不保存环境变量值。

My Stack 不应记录：

- 当前机器的安装路径，例如 `installPath`。
- 当前机器的扫描根目录，例如 `sourceRoot`。
- 当前机器的位置标签，例如 `location`。
- 运行时展示用的大段 description。
- 当前机器的 installed / missing 状态。
- 解析时间、扫描时间或日志字段。

### 9.8 Profile Sync

支持导出迁移文件：

```text
agentdock-profile.json
```

导出范围：

- 只导出 My Stack。
- 只导出全局组件。
- 只导出当前项目组件。
- 同时导出全局、项目和 client 配置摘要。
- 从当前安装状态生成 My Stack 后再导出。

Profile 应包含：

- profile schema version。
- 导出时间。
- AgentDock 版本。
- 组件列表。
- 组件类型。
- 来源。
- 版本、hash 或版本约束。
- 期望安装范围。
- 期望启用状态。
- bundle 信息。
- 需要的环境变量名称。

Profile 不应包含：

- API key。
- token。
- password。
- 本机私有路径中不必要的敏感信息。

导入功能：

- 读取 profile。
- 校验 profile schema。
- 展示将要安装、更新、启用、禁用或跳过的内容。
- 标记当前机器缺失的组件。
- 标记当前机器已有但版本不同的组件。
- 标记当前机器已安装但未保存到 My Stack 的组件。
- 生成恢复计划。
- 用户确认后一键恢复。

### 9.9 Logs / Diagnostics

提供基础诊断：

- Node.js 是否存在。
- npm / npx 是否可用。
- git 是否可用。
- curl 是否可用。
- 当前 npm config 是否可能导致 npx prefix 冲突。
- 网络是否能访问 manifest。
- 目标安装目录是否可写。
- client 配置文件是否可读写。
- 环境变量是否缺失。

展示日志：

- 安装日志。
- 更新日志。
- 启用 / 禁用日志。
- 卸载日志。
- 导入导出日志。
- 错误详情。

错误信息应面向普通用户，尽量给出下一步操作建议。

## 10. 组件类型

### 10.1 Skill

Skill 是 Agent 使用的能力说明、脚本和资源包。

第一版需要支持：

- 读取本机已安装 skills。
- 对比可用版本。
- 安装、更新、启用 / 禁用、卸载、导出、导入。
- 保存到 My Stack。

Skill adapter 应优先支持通用动作：

- 从 manifest 描述的来源下载或复制组件。
- 写入目标 skill 目录。
- 记录安装元数据。
- 通过禁用标记或 client 配置实现禁用。
- 卸载时只删除 AgentDock 能确认归属的文件。

### 10.2 MCP Server

MCP server 是可配置到 Codex、Claude Code、Claude Desktop、VS Code 等 client 的本地工具服务。

第一版需要支持：

- 显示可安装 MCP server。
- 读取本机已配置或已安装的 MCP server。
- 显示支持的 client。
- 安装到指定 client。
- 展示必需 env。
- 支持保存到 My Stack。
- 导出导入 MCP 选择，但不导出敏感 env 值。

MCP 的启用 / 禁用需要区分 client。第一版可以先支持展示状态和生成修改计划，后续再增强为对不同 client 配置文件的完整自动改写。

### 10.3 Plugin

Plugin 第一版需要支持基础扫描、展示和保存，不要求所有 plugin 都具备完整安装闭环。

第一版需要支持：

- 从已知安装目录、client 配置或 manifest 中发现本机 plugins。
- 显示 plugin 的名称、来源、版本或 unknown 状态。
- 显示是否已保存到 My Stack。
- 支持将 plugin 保存到 My Stack 并导出到 profile。
- 当 manifest 或 adapter 提供可靠安装动作时，支持安装计划和安装执行。

后续需要明确：

- plugin 安装位置。
- plugin 运行时。
- plugin 更新检测。
- plugin 启用 / 禁用和卸载策略。
- plugin 是否需要 marketplace 或签名机制。

### 10.4 Prompt

Prompt 第一版只预留 manifest 类型，不要求完整管理闭环。

后续可以支持：

- 浏览 prompt。
- 安装 prompt 到指定目录。
- 收藏和同步 prompt。
- 按用途组成 prompt bundle。

## 11. 安装范围模型

AgentDock 需要明确区分：

- `global`：当前用户全局可用。
- `project`：当前项目可用。
- `client`：只对某个 Agent client 生效，例如 Codex、Claude Code、Claude Desktop 或 VS Code。

UI 默认同时展示这些范围，并允许筛选。

常见场景：

- 普通个人工具适合全局安装。
- 项目专用能力适合项目安装。
- MCP server 和部分 plugin 需要按 client 启用。
- 团队共享 profile 可能更适合项目安装。

## 12. Manifest 设计方向

组件来源应提供给 AgentDock 消费的统一 manifest。manifest 描述“组件是什么、从哪里来、支持什么动作、需要哪些环境变量”，而不是要求用户理解底层命令。

示例结构：

```json
{
  "schemaVersion": 1,
  "generatedAt": "2026-05-25T00:00:00Z",
  "source": {
    "id": "default-catalog",
    "name": "Default Catalog",
    "trustLevel": "trusted"
  },
  "components": [
    {
      "id": "frontend-design",
      "type": "skill",
      "name": "frontend-design",
      "description": "Frontend design and UI component generation helper.",
      "source": {
        "kind": "git",
        "url": "https://example.com/skills.git",
        "path": "frontend-design"
      },
      "version": {
        "kind": "content-hash",
        "value": "..."
      },
      "tags": ["frontend", "design"],
      "bundles": ["core", "creative"],
      "install": {
        "supportsGlobal": true,
        "supportsProject": true,
        "supportsClient": false
      },
      "lifecycle": {
        "supportsInstall": true,
        "supportsUpdate": true,
        "supportsDisable": true,
        "supportsUninstall": true,
        "supportsSaveOnly": true
      },
      "requiredEnv": []
    }
  ],
  "bundles": [
    {
      "id": "core",
      "name": "Core",
      "description": "General-purpose starter bundle.",
      "components": ["frontend-design"]
    }
  ]
}
```

## 13. Profile 设计方向

示例结构：

```json
{
  "schemaVersion": 1,
  "exportedAt": "2026-05-25T00:00:00Z",
  "agentdockVersion": "0.1.0",
  "myStack": [
    {
      "id": "frontend-design",
      "type": "skill",
      "source": {
        "kind": "catalog",
        "catalogId": "default-catalog"
      },
      "version": "...",
      "preferredScope": "global",
      "desiredState": "enabled"
    }
  ],
  "snapshot": {
    "global": [
      {
        "id": "frontend-design",
        "type": "skill",
        "version": "...",
        "enabled": true
      }
    ],
    "project": [
      {
        "id": "playwright-cli",
        "type": "skill",
        "version": "...",
        "enabled": true
      }
    ],
    "clients": [
      {
        "client": "codex",
        "components": [
          {
            "id": "browser-tools",
            "type": "mcp",
            "version": "...",
            "enabled": true
          }
        ]
      }
    ]
  },
  "requiredEnv": [
    {
      "componentId": "some-mcp-server",
      "name": "SOME_API_KEY",
      "required": true
    }
  ]
}
```

## 14. 用户流程

### 14.1 查看本机状态

1. 用户运行 `npx agentdock`。
2. 浏览器打开本地页面。
3. Dashboard 显示已安装、可更新、已禁用、异常数量。
4. 用户进入 Inventory 查看组件列表。

### 14.2 安装组件

1. 用户打开 Catalog。
2. 搜索或筛选组件。
3. 选择安装范围：global、project 或 client。
4. 点击安装。
5. AgentDock 展示安装计划。
6. 用户确认。
7. 后端执行安装。
8. UI 展示结果和日志。
9. 用户可选择是否保存到 My Stack。

### 14.3 更新组件

1. 用户点击检查更新。
2. AgentDock 拉取或读取组件 manifest。
3. UI 显示可更新组件。
4. 用户选择单个或批量更新。
5. 用户确认更新计划。
6. 后端执行更新。
7. UI 展示结果。

### 14.4 禁用或卸载组件

1. 用户在 Inventory 中选择某个组件。
2. 用户选择禁用、启用或卸载。
3. AgentDock 展示影响范围和操作计划。
4. 用户确认。
5. 后端执行操作。
6. UI 展示结果和回滚或恢复建议。

### 14.5 保存好用组件

1. 用户在 Catalog 或安装结果中看到好用组件。
2. 用户点击保存到 My Stack。
3. AgentDock 记录来源、版本、推荐安装范围和所需 env 名称。
4. 用户之后可以从 My Stack 查看、安装、导出或移除该组件。

### 14.6 迁移到新机器

MVP 路径：

1. 旧机器把想长期保留的 skill 保存到 My Stack。
2. 将 My Stack JSON 文件带到新机器。
3. 新机器运行 `npx agentdock`。
4. 在界面中选择这个 My Stack 文件。
5. AgentDock 展示 `Install Plan`，区分已安装、可安装和缺少安装来源。
6. 用户复制安装脚本，在终端执行缺失 skills 的安装命令。

完整 Profile 路径：

1. 旧机器导出 `agentdock-profile.json`。
2. 新机器运行 `npx agentdock`。
3. 导入 profile。
4. AgentDock 展示将安装的组件和需要补充的环境变量。
5. 用户确认。
6. AgentDock 批量安装并展示结果。

## 15. 建议技术架构

第一版建议使用单仓库实现：

```text
agentdock/
  package.json
  src/
    cli/
    server/
    core/
    adapters/
    ui/
  docs/
  tests/
```

模块划分：

- `cli`：命令入口，启动本地服务，处理参数。
- `server`：本地 HTTP API。
- `core`：组件模型、状态扫描、状态对比、计划生成、profile 读写、My Stack 管理。
- `adapters`：skills、MCP、plugin、prompt、client 和平台差异的实现。
- `ui`：本地 Web 控制台。

核心内部流程：

1. `scan`：读取本机状态，生成 Inventory。
2. `loadCatalog`：读取一个或多个组件目录。
3. `resolve`：将 Inventory、Catalog 和 My Stack 对齐。
4. `plan`：为用户操作生成可审查计划。
5. `apply`：执行用户确认后的计划。
6. `log`：记录结果、错误和恢复建议。

建议 CLI 命令：

```bash
npx agentdock
npx agentdock status
npx agentdock check
npx agentdock install <component>
npx agentdock update
npx agentdock disable <component>
npx agentdock enable <component>
npx agentdock uninstall <component>
npx agentdock stack list
npx agentdock stack add <component>
npx agentdock stack remove <component>
npx agentdock export --output agentdock-profile.json
npx agentdock import agentdock-profile.json
```

## 16. API 设计方向

本地 Web UI 可以调用本地 API。

候选接口：

```text
GET  /api/status
GET  /api/inventory
GET  /api/catalog
GET  /api/stack
POST /api/check-updates
POST /api/stack/choose-file
POST /api/stack/path
POST /api/stack/skills
DELETE /api/stack/skills
POST /api/plan/install
POST /api/plan/update
POST /api/plan/enable
POST /api/plan/disable
POST /api/plan/uninstall
POST /api/apply
POST /api/stack/add
POST /api/stack/remove
POST /api/export-profile
POST /api/import-profile/preview
POST /api/import-profile/apply
GET  /api/logs
GET  /api/diagnostics
```

所有执行类操作应先生成 plan，再由用户确认后 apply。

## 17. 安全要求

- 本地服务默认只监听 `127.0.0.1`。
- 执行安装、更新、启用 / 禁用、卸载前必须展示操作计划。
- 不在 profile 中保存密钥值。
- 不在 My Stack 中保存密钥值。
- 日志中应尽量避免输出 token、API key。
- 第三方来源需要在 manifest 中明确标记。
- 支持非可信来源时，应增加来源警告和信任提示。
- 卸载只能删除 AgentDock 能确认归属的文件。
- 修改 client 配置前应保留备份或可恢复快照。

## 18. 第一阶段 MVP

MVP 建议只做：

- 本地 Web 控制台。
- CLI 启动入口。
- 统一组件模型、Inventory、Catalog、My Stack、Plan。
- Skills 扫描、安装、更新、禁用和卸载。
- MCP catalog 展示。
- MCP 已配置状态展示和安装计划。
- Plugins 基础扫描、展示和保存。
- My Stack 保存、查看和导出。
- Profile 导出导入。
- 基础 diagnostics。
- manifest 消费。

可以暂缓：

- MCP 完整一键安装到所有 client。
- Plugin 完整生命周期管理。
- Prompt 管理。
- 云同步。
- 桌面 App。

## 19. 里程碑建议

### M1：核心模型和 CLI

- 建立组件模型。
- 建立 Inventory 模型。
- 建立 My Stack 数据模型。
- 建立生命周期能力模型。
- 建立 Plan / Apply 执行模型。
- 实现 manifest 读取。
- 实现本地扫描。
- 实现状态对比。
- 提供 `agentdock status`。

### M2：本地 Web 控制台

- 启动本地 server。
- 打开浏览器。
- Dashboard。
- Inventory。
- Catalog。
- My Stack 基础页面。
- My Stack 文件创建、系统文件选择和手动路径 fallback。
- 安装计划预览和可复制安装脚本。

### M3：安装、更新和日志

- Skills 安装。
- Skills 更新。
- Skills 禁用、启用和卸载。
- 操作日志。
- 错误展示。
- Diagnostics。

### M4：My Stack 和 Profile Sync

- 保存组件到 My Stack。
- 从 My Stack 生成更完整的安装计划和一键恢复流程。
- 导出 profile。
- 导入预览。
- 导入执行。
- 新机器恢复流程。

### M5：MCP / Plugin 增强

- MCP 安装计划。
- client 选择。
- env 提示。
- MCP profile 同步。
- plugin 安装计划。
- plugin 生命周期能力补齐。

## 20. 待确认问题

1. 第一版内置哪些默认组件来源？
2. 是否允许用户添加任意第三方 manifest？
3. MCP 第一版是否需要做到真正一键安装，还是只展示和生成命令？
4. Profile 是否需要支持团队共享文件，例如 `agentdock.team.json`？
5. 禁用粒度第一版是否只支持 global / project，还是必须支持 client 级别？
6. plugin 第一版扫描哪些来源目录和 client 配置？
7. 是否需要为不同 client 做完整适配，例如 Codex、Claude Code、Claude Desktop、VS Code？
8. 是否需要保存用户偏好，例如默认安装到 global 还是 project？
9. My Stack 是否需要支持团队共享文件，例如 `agentdock.stack.json`？

## 21. 推荐结论

`AgentDock` 第一版应定位为：

> 一个通过 `npx agentdock` 启动的本地 Web 管理台，用统一状态模型查看、安装、更新、禁用、卸载、保存和迁移当前机器上的 Agent 能力组件。

最优路径不是先绑定某个既有仓库或脚本，而是先把四个核心模型做好：Inventory、Catalog、My Stack 和 Plan。只要这四个模型稳定，后续接入任何组件来源、任何 client、任何安装方式，都只是 adapter 的扩展。
