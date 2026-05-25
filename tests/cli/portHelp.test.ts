import { describe, expect, test } from "vitest";
import { formatPortBusyHelp } from "../../src/cli/portHelp.js";

describe("formatPortBusyHelp", () => {
  test("explains how to inspect and stop the process using the requested port", () => {
    const message = formatPortBusyHelp(3789, 3790);

    expect(message).toContain("Port 3789 is already in use");
    expect(message).toContain("AgentDock used 3790 instead");
    expect(message).toContain("lsof -nP -iTCP:3789 -sTCP:LISTEN");
    expect(message).toContain("lsof -ti tcp:3789 | xargs kill");
  });
});
