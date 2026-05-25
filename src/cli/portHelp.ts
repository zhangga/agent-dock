export function formatPortBusyHelp(requestedPort: number, usedPort: number): string {
  return [
    `Port ${requestedPort} is already in use. AgentDock used ${usedPort} instead.`,
    "",
    "To see what is using the original port:",
    `  lsof -nP -iTCP:${requestedPort} -sTCP:LISTEN`,
    "",
    "To stop that process on macOS/Linux:",
    `  lsof -ti tcp:${requestedPort} | xargs kill`,
    "",
    "Or start AgentDock on a specific port:",
    "  npm run dev -- --port 3790"
  ].join("\n");
}
