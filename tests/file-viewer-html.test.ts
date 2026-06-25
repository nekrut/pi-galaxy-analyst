// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FileViewer } from "../app/src/renderer/files/file-viewer.js";

function bytes(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

function button(root: HTMLElement, label: string): HTMLButtonElement {
  const found = Array.from(root.querySelectorAll("button")).find((b) => b.textContent === label);
  if (!found) throw new Error(`missing button: ${label}`);
  return found;
}

describe("FileViewer HTML preview", () => {
  let container: HTMLDivElement;
  let createObjectURL: ReturnType<typeof vi.fn>;
  let revokeObjectURL: ReturnType<typeof vi.fn>;
  let openFile: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    document.body.innerHTML = "";
    container = document.createElement("div");

    let nextBlobId = 0;
    createObjectURL = vi.fn(() => `blob:html-${++nextBlobId}`);
    revokeObjectURL = vi.fn();
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: createObjectURL,
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: revokeObjectURL,
    });

    openFile = vi.fn(async () => ({ opened: true }));
    Object.defineProperty(window, "orbit", {
      configurable: true,
      value: {
        openFile,
        readFile: vi.fn(),
        writeFile: vi.fn(async () => ({ ok: true })),
      },
    });
    Object.defineProperty(window, "confirm", {
      configurable: true,
      value: vi.fn(() => true),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("opens HTML in preview mode by default", () => {
    const viewer = new FileViewer(container);

    expect(viewer.open("report.html", bytes("<h1>Report</h1>"), 15)).toBe(true);

    const editor = container.querySelector<HTMLTextAreaElement>(".file-viewer-editor");
    const preview = container.querySelector<HTMLElement>(".file-viewer-html-preview");
    const iframe = container.querySelector<HTMLIFrameElement>(".file-viewer-html-frame");
    expect(editor).toBeNull();
    expect(preview?.classList.contains("hidden")).toBe(false);
    expect(iframe?.src).toBe("blob:html-1");
    expect(iframe?.getAttribute("sandbox")).toBe("allow-scripts");
    expect(iframe?.title).toBe("report.html");
  });

  it("does not render editing controls for HTML", () => {
    const viewer = new FileViewer(container);
    viewer.open("report.html", bytes("<h1>Report</h1>"), 15);

    const labels = Array.from(container.querySelectorAll("button")).map((b) => b.textContent);
    expect(labels).not.toContain("Edit");
    expect(labels).not.toContain("Preview");
    expect(labels).not.toContain("Save");
    expect(container.querySelector(".file-viewer-editor")).toBeNull();
  });

  it("opens HTML externally through the existing Orbit IPC", () => {
    const viewer = new FileViewer(container);
    viewer.open("reports/report.html", bytes("<h1>Report</h1>"), 15);

    button(container, "Open Externally").click();

    expect(openFile).toHaveBeenCalledWith("reports/report.html");
  });

  it("revokes HTML blob URLs when closing and reopening", () => {
    const viewer = new FileViewer(container);
    viewer.open("one.html", bytes("<h1>One</h1>"), 12);

    viewer.open("two.html", bytes("<h1>Two</h1>"), 12);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:html-1");

    viewer.close();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:html-2");
  });

  it("renders oversized HTML head previews as read-only source excerpts", () => {
    const viewer = new FileViewer(container);
    viewer.open("large.html", bytes("<h1>Partial"), 2_000_000, {
      kind: "head",
      lineCount: 1,
      byteBudgetHit: false,
    });

    expect(container.querySelector(".file-viewer-html-frame")).toBeNull();
    expect(container.querySelector(".file-viewer-editor")).toBeNull();
    expect(container.querySelector(".file-viewer-preview-text")?.textContent).toBe("<h1>Partial");
    expect(container.textContent).toContain("Preview only");
  });
});
