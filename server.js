const http = require("http");
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const ROOT = __dirname;
const INDEX_PATH = path.join(ROOT, "data", "index.json");
const PORT = process.env.PORT ? Number(process.env.PORT) : 8787;

const sessions = new Map();

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function getStoryPath(storyId) {
  const index = readJson(INDEX_PATH);
  const story = index.stories.find((entry) => entry.id === storyId);
  if (!story) return null;
  return path.join(ROOT, story.path);
}

function ensureSession(storyId) {
  let session = sessions.get(storyId);
  if (session && session.proc && session.proc.exitCode === null) {
    return session;
  }

  const proc = spawn("codex", [], {
    cwd: ROOT,
    stdio: ["pipe", "pipe", "pipe"],
    windowsHide: true
  });

  proc.stdout.on("data", (chunk) => {
    process.stdout.write(`[codex:${storyId}] ${chunk}`);
  });
  proc.stderr.on("data", (chunk) => {
    process.stderr.write(`[codex:${storyId}][err] ${chunk}`);
  });
  proc.on("error", (error) => {
    console.error(`[codex:${storyId}] spawn failed: ${error.message}`);
  });
  proc.on("exit", (code) => {
    console.log(`[codex:${storyId}] exited with code ${code}`);
    const current = sessions.get(storyId);
    if (current && current.proc === proc) {
      sessions.delete(storyId);
    }
  });

  session = { proc, queue: Promise.resolve(), lastUsed: Date.now() };
  sessions.set(storyId, session);
  return session;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForLogUpdate(logPath, timeoutMs = 120000) {
  let lastStat = null;
  try {
    lastStat = fs.statSync(logPath);
  } catch {
    lastStat = null;
  }

  const start = Date.now();
  let lastChange = Date.now();
  let seenChange = false;

  while (Date.now() - start < timeoutMs) {
    await sleep(400);
    let stat = null;
    try {
      stat = fs.statSync(logPath);
    } catch {
      stat = null;
    }
    const changed =
      (!lastStat && stat) ||
      (lastStat &&
        stat &&
        (stat.mtimeMs !== lastStat.mtimeMs || stat.size !== lastStat.size));
    if (changed) {
      seenChange = true;
      lastChange = Date.now();
      lastStat = stat;
    }
    if (seenChange && Date.now() - lastChange > 1000) {
      return true;
    }
  }
  return false;
}

async function handlePrompt(storyId, text) {
  const storyPath = getStoryPath(storyId);
  if (!storyPath) {
    throw new Error("Unknown story id.");
  }
  const logPath = path.join(storyPath, "log.json");
  const session = ensureSession(storyId);
  session.lastUsed = Date.now();

  if (!session.proc || session.proc.exitCode !== null) {
    throw new Error("Codex session not available.");
  }

  session.proc.stdin.write(`${text}\n`);
  await waitForLogUpdate(logPath);
}

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(body)
  });
  res.end(body);
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        reject(new Error("Payload too large"));
      }
    });
    req.on("end", () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(error);
      }
    });
  });
}

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".woff": "font/woff",
  ".woff2": "font/woff2"
};

function serveStatic(res, filePath) {
  if (!fs.existsSync(filePath)) {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not found");
    return;
  }
  const stat = fs.statSync(filePath);
  if (stat.isDirectory()) {
    res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Forbidden");
    return;
  }
  const ext = path.extname(filePath).toLowerCase();
  const type = MIME[ext] || "application/octet-stream";
  res.writeHead(200, { "Content-Type": type, "Content-Length": stat.size });
  fs.createReadStream(filePath).pipe(res);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (url.pathname === "/api/prompt" && req.method === "POST") {
    try {
      const body = await parseBody(req);
      const storyId = String(body.storyId || "").trim();
      const text = String(body.text || "").trim();
      if (!storyId || !text) {
        sendJson(res, 400, { ok: false, error: "Missing storyId or text." });
        return;
      }
      const session = ensureSession(storyId);
      const run = session.queue.then(() => handlePrompt(storyId, text));
      session.queue = run.catch(() => {});
      await run;
      sendJson(res, 200, { ok: true });
    } catch (error) {
      sendJson(res, 500, { ok: false, error: error.message });
    }
    return;
  }

  if (url.pathname.startsWith("/data/")) {
    const filePath = path.join(ROOT, url.pathname);
    serveStatic(res, filePath);
    return;
  }
  if (url.pathname.startsWith("/assets/")) {
    const filePath = path.join(ROOT, url.pathname);
    serveStatic(res, filePath);
    return;
  }
  if (url.pathname.startsWith("/dist/")) {
    const filePath = path.join(ROOT, url.pathname);
    serveStatic(res, filePath);
    return;
  }

  const safePath = url.pathname === "/" ? "/index.html" : url.pathname;
  const filePath = path.join(ROOT, "web", safePath);
  serveStatic(res, filePath);
});

server.listen(PORT, () => {
  console.log(`Codex UI server running on http://localhost:${PORT}`);
});
