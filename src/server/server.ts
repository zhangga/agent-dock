import { execFile } from "node:child_process";
import { access } from "node:fs/promises";
import { constants } from "node:fs";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { dirname } from "node:path";
import { promisify } from "node:util";
import { readAgentDockConfig, setConfiguredStackPath } from "../core/configStore.js";
import { runDiagnostics, summarizeDiagnostics, type RunDiagnosticsOptions } from "../core/diagnostics.js";
import {
  resolveSkillInstallFromSkillsSh,
  type SkillInstallResolver
} from "../core/skillInstallResolver.js";
import { removeInstalledSkill, type SkillRemoveRunner } from "../core/skillRemover.js";
import { scanInstalledSkills } from "../core/skillScanner.js";
import {
  buildRestorePlan,
  normalizeInstallInput,
  restoreMissingSkills,
  stackSkillFromInstallInput,
  type RestoreCommandRunner
} from "../core/skillRestoreExecutor.js";
import {
  addSkillToStack,
  addStackSkillToStack,
  createStackFile,
  readStack,
  readStackFileState,
  removeSkillFromStack,
  updateSkillSourceInStack,
  writeStackFile,
  type StackSkillInstall
} from "../core/stackStore.js";
import {
  applyProfileImport,
  createProfileFromStack,
  parseProfileInput,
  previewProfileImport
} from "../core/profileStore.js";
import {
  checkSkillUpdates,
  type SkillUpdateProbe
} from "../core/updateChecker.js";
import {
  chooseStackFileWithSystemPicker,
  type StackFilePicker
} from "../system/stackFilePicker.js";
import { renderConsoleHtml } from "../ui/page.js";

const execFileAsync = promisify(execFile);

export interface StackFileRevealResult {
  revealed?: boolean;
  unavailable?: boolean;
  message?: string;
}

export type StackFileRevealer = (path: string) => Promise<StackFileRevealResult>;

export interface AgentDockServerOptions {
  skillRoots?: string[];
  stackPath?: string;
  configPath?: string;
  chooseStackFile?: StackFilePicker;
  revealStackFile?: StackFileRevealer;
  resolveSkillInstall?: SkillInstallResolver;
  restoreRunner?: RestoreCommandRunner;
  removeSkillRunner?: SkillRemoveRunner;
  updateProbe?: SkillUpdateProbe;
  diagnostics?: RunDiagnosticsOptions;
}

export function createAgentDockServer(options: AgentDockServerOptions = {}): Server {
  return createServer(async (request, response) => {
    try {
      await handleRequest(request, response, options);
    } catch (error) {
      console.error(error);
      sendJson(response, 500, { error: "Internal server error" });
    }
  });
}

async function handleRequest(
  request: IncomingMessage,
  response: ServerResponse,
  options: AgentDockServerOptions
): Promise<void> {
  const url = new URL(request.url ?? "/", "http://127.0.0.1");

  if (request.method === "GET" && (url.pathname === "/" || url.pathname === "/index.html")) {
    sendHtml(response, renderConsoleHtml());
    return;
  }

  if (request.method === "GET" && url.pathname === "/favicon.ico") {
    response.writeHead(204, { "cache-control": "public, max-age=86400" });
    response.end();
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/skills") {
    const skills = await scanInstalledSkills({ roots: options.skillRoots });
    sendJson(response, 200, { skills });
    return;
  }

  if (request.method === "DELETE" && url.pathname === "/api/skills") {
    const body = await readJsonBody(request);
    const skill = await findInstalledSkillFromBody(body, options);

    if (!skill) {
      sendJson(response, 404, { error: "Skill not found" });
      return;
    }

    try {
      const removed = await removeInstalledSkill(skill, { runner: options.removeSkillRunner });
      const stackPath = await resolveStackPath(options);
      const [skills, stack, stackFile] = await Promise.all([
        scanInstalledSkills({ roots: options.skillRoots }),
        readStack({ stackPath }),
        readStackFileState({ stackPath })
      ]);
      sendJson(response, 200, { removed, skills, stack, stackFile });
    } catch (error) {
      sendJson(response, 400, {
        error: error instanceof Error ? error.message : "Could not uninstall skill"
      });
    }
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/stack") {
    const stackPath = await resolveStackPath(options);
    const stack = await readStack({ stackPath });
    const stackFile = await readStackFileState({ stackPath });
    sendJson(response, 200, { stack, stackFile });
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/stack/create") {
    const stackPath = await resolveStackPath(options);
    const stack = await createStackFile({ stackPath });
    const stackFile = await readStackFileState({ stackPath });
    sendJson(response, 200, { stack, stackFile });
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/stack/path") {
    const body = await readJsonBody(request);
    const stackPath = typeof body.path === "string" ? body.path.trim() : "";

    if (!stackPath) {
      sendJson(response, 400, { error: "Stack path is required" });
      return;
    }

    const config = await setConfiguredStackPath(stackPath, { configPath: options.configPath });
    const stack = await createStackFile({ stackPath: config.stackPath });
    const stackFile = await readStackFileState({ stackPath: config.stackPath });
    sendJson(response, 200, { stack, stackFile });
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/stack/choose-file") {
    const currentPath = await resolveStackPath(options);
    const chooseStackFile = options.chooseStackFile ?? chooseStackFileWithSystemPicker;
    const result = await chooseStackFile({ currentPath });

    if (result.canceled) {
      sendJson(response, 200, { canceled: true });
      return;
    }

    if (result.unavailable || !result.path) {
      sendJson(response, 501, {
        error: result.message ?? "System file picker is not available."
      });
      return;
    }

    const config = await setConfiguredStackPath(result.path, { configPath: options.configPath });
    const stack = await createStackFile({ stackPath: config.stackPath });
    const stackFile = await readStackFileState({ stackPath: config.stackPath });
    sendJson(response, 200, { stack, stackFile });
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/stack/reveal") {
    const stackPath = await resolveStackPath(options);
    const stackFile = await readStackFileState({ stackPath });

    if (!stackFile.exists) {
      sendJson(response, 404, { error: "Create the backup file before opening its location." });
      return;
    }

    const revealStackFile = options.revealStackFile ?? revealStackFileWithSystem;
    const result = await revealStackFile(stackFile.path);

    if (result.unavailable) {
      sendJson(response, 501, { error: result.message ?? "Could not open the backup file location." });
      return;
    }

    sendJson(response, 200, { revealed: true, stackFile });
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/stack/skills/resolve") {
    const body = await readJsonBody(request);
    const skill = await findInstalledSkillFromBody(body, options);

    if (!skill) {
      sendJson(response, 404, { error: "Skill not found" });
      return;
    }

    const resolveSkillInstall = options.resolveSkillInstall ?? resolveSkillInstallFromSkillsSh;
    const install = await resolveSkillInstall(skill);
    sendJson(response, 200, {
      skill: {
        id: skill.id,
        name: skill.name
      },
      install,
      command: install.status === "resolved" ? install.command : ""
    });
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/stack/skills") {
    const body = await readJsonBody(request);
    const installCommand = typeof body.install === "string" ? body.install.trim() : "";

    if (!installCommand) {
      sendJson(response, 400, { error: "Install command or GitHub skill URL is required before a skill can be saved to backup." });
      return;
    }

    const parsedCommand = normalizeInstallInput(installCommand);
    if (!parsedCommand) {
      sendJson(response, 400, { error: "Enter a npx skills add command or a GitHub skill URL." });
      return;
    }

    const skill = await findInstalledSkillFromBody(body, options);

    if (!skill) {
      sendJson(response, 404, { error: "Skill not found" });
      return;
    }

    const stackPath = await resolveStackPath(options);
    const install = toResolvedInstall(parsedCommand.display);
    const stack = await addSkillToStack(skill, { stackPath, install });
    const stackFile = await readStackFileState({ stackPath });
    sendJson(response, 200, { stack, stackFile });
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/stack/skills/manual") {
    const body = await readJsonBody(request);
    const install = typeof body.install === "string" ? body.install.trim() : "";

    if (!install) {
      sendJson(response, 400, { error: "Install command or GitHub skill URL is required." });
      return;
    }

    const skill = stackSkillFromInstallInput(install);
    if (!skill) {
      sendJson(response, 400, { error: "Enter a npx skills add command or a GitHub skill URL." });
      return;
    }

    const stackPath = await resolveStackPath(options);
    const stack = await addStackSkillToStack(skill, { stackPath });
    const stackFile = await readStackFileState({ stackPath });
    sendJson(response, 200, { stack, stackFile, skill: { id: skill.id } });
    return;
  }

  if (request.method === "DELETE" && url.pathname === "/api/stack/skills") {
    const body = await readJsonBody(request);
    const id = typeof body.id === "string" ? body.id.trim() : "";

    if (!id) {
      sendJson(response, 400, { error: "Skill id is required" });
      return;
    }

    const stackPath = await resolveStackPath(options);
    const stack = await removeSkillFromStack({ id }, { stackPath });
    const stackFile = await readStackFileState({ stackPath });
    sendJson(response, 200, { stack, stackFile });
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/restore/skills/plan") {
    const stackPath = await resolveStackPath(options);
    const [stack, skills] = await Promise.all([
      readStack({ stackPath }),
      scanInstalledSkills({ roots: options.skillRoots })
    ]);

    sendJson(response, 200, { plan: buildRestorePlan(stack, skills) });
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/restore/skills/apply") {
    const body = await readJsonBody(request);
    const ids = Array.isArray(body.ids) ? body.ids.filter((id): id is string => typeof id === "string") : undefined;
    const stackPath = await resolveStackPath(options);
    const [stack, skills] = await Promise.all([
      readStack({ stackPath }),
      scanInstalledSkills({ roots: options.skillRoots })
    ]);
    const results = await restoreMissingSkills(stack, skills, {
      ids,
      ...(options.restoreRunner ? { runner: options.restoreRunner } : {})
    });

    sendJson(response, 200, { results });
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/check-updates") {
    const stackPath = await resolveStackPath(options);
    const [stack, skills] = await Promise.all([
      readStack({ stackPath }),
      scanInstalledSkills({ roots: options.skillRoots })
    ]);

    const updates = await checkSkillUpdates(stack, skills, {
      ...(options.updateProbe ? { probe: options.updateProbe } : {})
    });

    sendJson(response, 200, { updates });
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/stack/skills/source") {
    const body = await readJsonBody(request);
    const id = typeof body.id === "string" ? body.id.trim() : "";
    const install = typeof body.install === "string" ? body.install.trim() : "";

    if (!id || !install) {
      sendJson(response, 400, { error: "Skill id and install command are required." });
      return;
    }

    const parsedCommand = normalizeInstallInput(install);
    if (!parsedCommand) {
      sendJson(response, 400, { error: "Enter a npx skills add command or a GitHub skill URL." });
      return;
    }

    const stackPath = await resolveStackPath(options);
    const stack = await updateSkillSourceInStack(
      { id },
      {
        type: "command",
        install: parsedCommand.display
      },
      { stackPath }
    );

    if (!stack) {
      sendJson(response, 404, { error: "Skill not found in backup" });
      return;
    }

    const stackFile = await readStackFileState({ stackPath });
    sendJson(response, 200, { stack, stackFile });
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/diagnostics") {
    const stackPath = await resolveStackPath(options);
    const checks = await runDiagnostics({
      ...options.diagnostics,
      stackPath,
      skillRoots: options.skillRoots ?? options.diagnostics?.skillRoots
    });

    sendJson(response, 200, {
      checks,
      summary: summarizeDiagnostics(checks)
    });
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/profile/export") {
    const stackPath = await resolveStackPath(options);
    const stack = await readStack({ stackPath });
    sendJson(response, 200, {
      fileName: "agentdock-profile.json",
      profile: createProfileFromStack(stack)
    });
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/profile/import/preview") {
    const body = await readJsonBody(request);
    const stackPath = await resolveStackPath(options);
    const stack = await readStack({ stackPath });

    try {
      const profile = parseProfileInput(body.profile);
      sendJson(response, 200, {
        preview: previewProfileImport(profile, stack)
      });
    } catch (error) {
      sendJson(response, 400, {
        error: error instanceof Error ? error.message : "Could not read profile"
      });
    }
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/profile/import/apply") {
    const body = await readJsonBody(request);
    const stackPath = await resolveStackPath(options);
    const stack = await readStack({ stackPath });

    try {
      const profile = parseProfileInput(body.profile);
      const result = applyProfileImport(profile, stack);
      const nextStack = await writeStackFile(result.stack, { stackPath });
      const stackFile = await readStackFileState({ stackPath });
      sendJson(response, 200, {
        stack: nextStack,
        stackFile,
        preview: result.preview
      });
    } catch (error) {
      sendJson(response, 400, {
        error: error instanceof Error ? error.message : "Could not import profile"
      });
    }
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/health") {
    sendJson(response, 200, { ok: true });
    return;
  }

  sendJson(response, 404, { error: "Not found" });
}

async function resolveStackPath(options: AgentDockServerOptions): Promise<string | undefined> {
  if (options.stackPath) {
    return options.stackPath;
  }

  const config = await readAgentDockConfig({ configPath: options.configPath });
  return config.stackPath;
}

async function findInstalledSkillFromBody(body: Record<string, unknown>, options: AgentDockServerOptions) {
  const id = typeof body.id === "string" ? body.id : "";
  const installPath = typeof body.installPath === "string" ? body.installPath : "";
  const skills = await scanInstalledSkills({ roots: options.skillRoots });
  return skills.find((item) => item.id === id && item.installPath === installPath);
}

function toResolvedInstall(command: string): StackSkillInstall {
  return {
    status: "resolved",
    source: "skills.sh",
    command,
    resolvedAt: new Date().toISOString()
  };
}

async function revealStackFileWithSystem(path: string): Promise<StackFileRevealResult> {
  try {
    await access(path, constants.F_OK);
  } catch {
    return {
      unavailable: true,
      message: "Create the backup file before opening its location."
    };
  }

  try {
    if (process.platform === "darwin") {
      await execFileAsync("open", ["-R", path], { timeout: 15000 });
      return { revealed: true };
    }

    if (process.platform === "win32") {
      await execFileAsync("explorer.exe", [`/select,${path}`], { timeout: 15000 });
      return { revealed: true };
    }

    await execFileAsync("xdg-open", [dirname(path)], { timeout: 15000 });
    return { revealed: true };
  } catch {
    return {
      unavailable: true,
      message: "Could not open the backup file location."
    };
  }
}

function sendHtml(response: ServerResponse, html: string): void {
  response.writeHead(200, {
    "content-type": "text/html; charset=utf-8",
    "cache-control": "no-store"
  });
  response.end(html);
}

function sendJson(response: ServerResponse, statusCode: number, payload: unknown): void {
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store"
  });
  response.end(JSON.stringify(payload));
}

function readJsonBody(request: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    let body = "";

    request.setEncoding("utf8");
    request.on("data", (chunk) => {
      body += chunk;
    });
    request.on("end", () => {
      try {
        resolve(body ? (JSON.parse(body) as Record<string, unknown>) : {});
      } catch (error) {
        reject(error);
      }
    });
    request.on("error", reject);
  });
}
