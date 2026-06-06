import { describe, it, expect } from "vitest";
import { resolveExecutable, uvxMissingNotice } from "../bin/uvx-check.js";

describe("resolveExecutable", () => {
  it("finds an executable in a later PATH dir", () => {
    const found = resolveExecutable("uvx", {
      pathEnv: "/usr/bin:/opt/uv/bin",
      platform: "linux",
      isExecutable: (p) => p === "/opt/uv/bin/uvx",
    });
    expect(found).toBe("/opt/uv/bin/uvx");
  });

  it("returns null when the command is on no PATH dir", () => {
    const found = resolveExecutable("uvx", {
      pathEnv: "/usr/bin:/bin",
      platform: "linux",
      isExecutable: () => false,
    });
    expect(found).toBeNull();
  });

  it("returns null for an empty PATH instead of resolving the cwd", () => {
    const found = resolveExecutable("uvx", {
      pathEnv: "",
      platform: "linux",
      isExecutable: () => true,
    });
    expect(found).toBeNull();
  });

  it("skips empty PATH segments so a leading ':' can't match the cwd", () => {
    const probed: string[] = [];
    resolveExecutable("uvx", {
      pathEnv: ":/opt/bin",
      platform: "linux",
      isExecutable: (p) => {
        probed.push(p);
        return false;
      },
    });
    expect(probed).toEqual(["/opt/bin/uvx"]);
  });

  it("appends PATHEXT suffixes on Windows", () => {
    const found = resolveExecutable("uvx", {
      pathEnv: "C:\\tools",
      platform: "win32",
      pathExt: ".EXE;.CMD",
      isExecutable: (p) => p.endsWith("uvx.EXE"),
    });
    // Assert the full path, not just the suffix: the separator must come from
    // the injected platform, not the host OS. This is exactly what broke on the
    // Windows runner -- path.join used native separators regardless of platform.
    expect(found).toBe("C:\\tools\\uvx.EXE");
  });
});

describe("uvxMissingNotice", () => {
  it("names uvx, points at the uv installer, and says Galaxy is the casualty", () => {
    const msg = uvxMissingNotice();
    expect(msg).toContain("uvx");
    expect(msg).toContain("astral.sh");
    expect(msg.toLowerCase()).toContain("galaxy");
  });
});
