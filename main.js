const { app, BrowserWindow, ipcMain, protocol } = require("electron");
const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");

const ROOT_DIR = __dirname;

protocol.registerSchemesAsPrivileged([
  {
    scheme: "app",
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true
    }
  }
]);

function registerAppProtocol() {
  protocol.registerFileProtocol("app", (request, callback) => {
    try {
      const url = new URL(request.url);
      const relativePath = decodeURIComponent(url.pathname).replace(/^\/+/, "");
      const resolvedPath = path.normalize(path.join(ROOT_DIR, relativePath));
      if (!resolvedPath.startsWith(ROOT_DIR)) {
        callback({ error: -6 });
        return;
      }
      callback({ path: resolvedPath });
    } catch (error) {
      callback({ error: -2 });
    }
  });
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 820,
    backgroundColor: "#f3efe6",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(ROOT_DIR, "preload.js")
    }
  });

  win.loadURL("app://./web/index.html");
}

function sanitizeFilename(value) {
  return value.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function dataUrlToBuffer(dataUrl) {
  const match = /^data:([^;]+);base64,(.*)$/.exec(dataUrl || "");
  if (!match) return null;
  return {
    mime: match[1],
    buffer: Buffer.from(match[2], "base64")
  };
}

function getExtension(mime, fallbackExt) {
  if (fallbackExt) return fallbackExt;
  const map = {
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "image/jpg": ".jpg",
    "image/webp": ".webp",
    "image/gif": ".gif"
  };
  return map[mime] || ".png";
}

function registerIpc() {
  ipcMain.handle("save-image", async (_event, payload) => {
    const { dataUrl, filename, name, scope, type, id } = payload || {};
    const decoded = dataUrlToBuffer(dataUrl);
    if (!decoded) {
      throw new Error("Invalid image data.");
    }
    const safeScope = sanitizeFilename(scope || "global");
    const safeType = sanitizeFilename(type || "image");
    const safeName = sanitizeFilename(name || id || path.parse(filename || "image").name || "image");
    const base = `${safeName}-${safeScope}`;
    const relativeDir = path.join(safeScope, safeType);
    const imagesDir = app.isPackaged
      ? path.join(app.getPath("userData"), "images", relativeDir)
      : path.join(ROOT_DIR, "assets", "uploads", relativeDir);
    await fs.promises.mkdir(imagesDir, { recursive: true });
    const ext = getExtension(decoded.mime, path.extname(filename || "") || "");
    let filePath = path.join(imagesDir, `${base}${ext}`);
    let counter = 2;
    while (fs.existsSync(filePath)) {
      filePath = path.join(imagesDir, `${base}-${counter}${ext}`);
      counter += 1;
    }
    await fs.promises.writeFile(filePath, decoded.buffer);
    if (app.isPackaged) {
      return pathToFileURL(filePath).toString();
    }
    const relative = path.relative(ROOT_DIR, filePath).split(path.sep).join("/");
    return `app://./${relative}`;
  });
}

app.whenReady().then(() => {
  registerAppProtocol();
  registerIpc();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
