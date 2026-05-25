import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export interface StackFilePickerOptions {
  currentPath?: string;
}

export interface StackFilePickerResult {
  path?: string;
  canceled?: boolean;
  unavailable?: boolean;
  message?: string;
}

export type StackFilePicker = (options: StackFilePickerOptions) => Promise<StackFilePickerResult>;

export async function chooseStackFileWithSystemPicker(
  options: StackFilePickerOptions = {}
): Promise<StackFilePickerResult> {
  if (process.platform === "darwin") {
    return chooseStackFileWithAppleScript(options);
  }

  return {
    unavailable: true,
    message: "System file picker is not available on this platform yet."
  };
}

async function chooseStackFileWithAppleScript(
  options: StackFilePickerOptions
): Promise<StackFilePickerResult> {
  const defaultName = getDefaultStackFileName(options.currentPath);
  const script = [
    `set chosenFile to choose file name with prompt "Choose or create AgentDock stack file" default name "${escapeAppleScriptString(defaultName)}"`,
    "return POSIX path of chosenFile"
  ].join("\n");

  try {
    const { stdout } = await execFileAsync("osascript", ["-e", script], {
      timeout: 120000
    });
    const path = stdout.trim();
    return path ? { path } : { canceled: true };
  } catch (error) {
    if (isPickerCanceled(error)) {
      return { canceled: true };
    }

    return {
      unavailable: true,
      message: "Could not open the system file picker."
    };
  }
}

function getDefaultStackFileName(currentPath?: string): string {
  const fallback = "stack.json";
  const path = currentPath?.trim();

  if (!path) {
    return fallback;
  }

  const parts = path.split("/");
  const fileName = parts.at(-1)?.trim();
  return fileName || fallback;
}

function escapeAppleScriptString(value: string): string {
  return value.replaceAll("\\", "\\\\").replaceAll('"', '\\"');
}

function isPickerCanceled(error: unknown): boolean {
  const details = [
    getErrorField(error, "message"),
    getErrorField(error, "stderr"),
    getErrorField(error, "stdout")
  ].join("\n");

  return details.includes("User canceled") || details.includes("-128");
}

function getErrorField(error: unknown, field: string): string {
  if (error && typeof error === "object" && field in error) {
    const value = (error as Record<string, unknown>)[field];
    return typeof value === "string" ? value : "";
  }

  return "";
}
