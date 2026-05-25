import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { homedir } from "node:os";
import { dirname, isAbsolute, join, resolve } from "node:path";

export interface AgentDockConfig {
  schemaVersion: 1;
  stackPath?: string;
}

export interface ConfigStoreOptions {
  configPath?: string;
}

export function getDefaultConfigPath(): string {
  return join(homedir(), ".agentdock", "config.json");
}

export async function readAgentDockConfig(options: ConfigStoreOptions = {}): Promise<AgentDockConfig> {
  const configPath = options.configPath ?? getDefaultConfigPath();

  if (!(await pathExists(configPath))) {
    return emptyConfig();
  }

  const content = await readFile(configPath, "utf8");
  const parsed = JSON.parse(content) as Partial<AgentDockConfig>;
  const stackPath = typeof parsed.stackPath === "string" ? parsed.stackPath.trim() : "";

  return {
    schemaVersion: 1,
    ...(stackPath ? { stackPath } : {})
  };
}

export async function setConfiguredStackPath(
  stackPath: string,
  options: ConfigStoreOptions = {}
): Promise<AgentDockConfig> {
  const configPath = options.configPath ?? getDefaultConfigPath();
  const config = await readAgentDockConfig({ configPath });
  const nextConfig: AgentDockConfig = {
    ...config,
    schemaVersion: 1,
    stackPath: normalizeStackPath(stackPath)
  };

  await mkdir(dirname(configPath), { recursive: true });
  await writeFile(configPath, `${JSON.stringify(nextConfig, null, 2)}\n`, "utf8");
  return nextConfig;
}

export function normalizeStackPath(stackPath: string): string {
  const trimmed = stackPath.trim();

  if (!trimmed) {
    throw new Error("Stack path is required");
  }

  if (trimmed === "~") {
    return homedir();
  }

  if (trimmed.startsWith("~/")) {
    return join(homedir(), trimmed.slice(2));
  }

  return isAbsolute(trimmed) ? trimmed : resolve(trimmed);
}

function emptyConfig(): AgentDockConfig {
  return {
    schemaVersion: 1
  };
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}
