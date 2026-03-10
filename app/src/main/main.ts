import { app, BrowserWindow, Menu, dialog } from "electron";
import path from "node:path";
import os from "node:os";
import { registerIpcHandlers } from "./ipc-handlers.js";
import { AgentManager } from "./agent.js";

declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string | undefined;
declare const MAIN_WINDOW_VITE_NAME: string;

function log(...args: unknown[]): void {
  console.log("[main]", ...args);
}

let mainWindow: BrowserWindow | null = null;
let agentManager: AgentManager | null = null;

async function selectWorkingDirectory(): Promise<string> {
  const result = await dialog.showOpenDialog({
    title: "Choose analysis directory",
    defaultPath: os.homedir(),
    properties: ["openDirectory", "createDirectory"],
    message: "Select a directory to work in. gxypi will look for notebooks here.",
  });

  if (result.canceled || result.filePaths.length === 0) {
    return os.homedir();
  }
  return result.filePaths[0];
}

function createWindow(cwd: string): void {
  log("creating window, cwd:", cwd);

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 700,
    minHeight: 500,
    title: "gxypi",
    titleBarStyle: "hiddenInset",
    webPreferences: {
      preload: path.join(__dirname, "../preload/preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`)
    );
  }

  agentManager = new AgentManager(mainWindow, cwd);
  registerIpcHandlers(agentManager);

  agentManager.start();

  mainWindow.on("closed", () => {
    log("window closed");
    mainWindow = null;
  });
}

function buildMenu(): void {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: "gxypi",
      submenu: [
        { role: "about" },
        { type: "separator" },
        { role: "quit" },
      ],
    },
    {
      label: "Edit",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        { role: "selectAll" },
      ],
    },
    {
      label: "View",
      submenu: [
        {
          label: "Toggle Sidebar",
          accelerator: "CmdOrCtrl+B",
          click: () => mainWindow?.webContents.send("view:toggle-sidebar"),
        },
        { type: "separator" },
        { role: "toggleDevTools" },
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" },
      ],
    },
    {
      label: "Help",
      submenu: [
        {
          label: "gxypi Documentation",
          click: () => {
            import("electron").then(({ shell }) => {
              shell.openExternal("https://github.com/galaxyproject/gxypi");
            });
          },
        },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

app.whenReady().then(async () => {
  log("app ready");
  buildMenu();

  // Use GXYPI_CWD env var if set, otherwise prompt
  let cwd = process.env.GXYPI_CWD;
  if (!cwd) {
    cwd = await selectWorkingDirectory();
  }
  log("selected cwd:", cwd);
  createWindow(cwd);

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow(cwd);
    }
  });
});

app.on("window-all-closed", () => {
  log("all windows closed");
  agentManager?.stop();
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  log("before-quit");
  agentManager?.stop();
});
