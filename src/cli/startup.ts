import { readAgentDockConfig } from "../core/configStore.js";
import {
  createStackFile,
  getDefaultStackPath,
  readStackFileState
} from "../core/stackStore.js";

export interface EnsureDefaultStackFileOptions {
  configPath?: string;
  stackPath?: string;
}

export interface EnsureDefaultStackFileResult {
  path: string;
  created: boolean;
  error?: string;
}

export async function ensureDefaultStackFile(
  options: EnsureDefaultStackFileOptions = {}
): Promise<EnsureDefaultStackFileResult> {
  const stackPath = await resolveStackPath(options);
  const state = await readStackFileState({ stackPath });

  if (state.exists) {
    return { path: stackPath, created: false };
  }

  try {
    await createStackFile({ stackPath });
    return { path: stackPath, created: true };
  } catch (error) {
    return {
      path: stackPath,
      created: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

async function resolveStackPath(options: EnsureDefaultStackFileOptions): Promise<string> {
  if (options.stackPath) {
    return options.stackPath;
  }

  const config = await readAgentDockConfig({ configPath: options.configPath });
  return config.stackPath ?? getDefaultStackPath();
}
