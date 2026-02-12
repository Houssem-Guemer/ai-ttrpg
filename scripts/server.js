#!/usr/bin/env node
"use strict";

const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { spawn, spawnSync } = require("child_process");

const root = path.resolve(__dirname, "..");
const uploadDir = path.join(root, "assets", "uploads");
const indexPath = path.join(root, "data", "index.json");
const sessions = new Map();
let narratorCommand;

const mimeTypes = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "text/javascript",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml"
};

function send(res, status, body, headers = {}) {
  res.writeHead(status, headers);
  res.end(body);
}

function sendJson(res, status, payload) {
  send(res, status, JSON.stringify(payload), { "Content-Type": "application/json" });
}

function isCommandAvailable(command) {
  const checker = process.platform === "win32" ? "where" : "which";
  const result = spawnSync(checker, [command], { stdio: "ignore" });
  return result.status === 0;
}

function resolveNarratorCommand() {
  if (narratorCommand) return narratorCommand;

  const configured = String(process.env.NARRATOR_COMMAND || "").trim();
  if (configured) {
    narratorCommand = { command: configured, baseArgs: [] };
    return narratorCommand;
  }

  if (process.platform === "win32") {
    const appData = process.env.APPDATA || "";
    const codexJs = path.join(appData, "npm", "node_modules", "@openai", "codex", "bin", "codex.js");
    if (codexJs && fs.existsSync(codexJs)) {
      narratorCommand = { command: process.execPath, baseArgs: [codexJs] };
      return narratorCommand;
    }
  }

  if (isCommandAvailable("codex")) {
    narratorCommand = { command: "codex", baseArgs: [] };
    return narratorCommand;
  }
  return null;
}

function narratorMissingMessage() {
  return [
    "Narrator CLI not found.",
    "Install Codex CLI and ensure `codex` is in PATH,",
    "or set NARRATOR_COMMAND to the executable path."
  ].join(" ");
}

function safeJoin(base, target) {
  const targetPath = path.normalize(path.join(base, target));
  if (!targetPath.startsWith(base)) return null;
  return targetPath;
}

function serveStatic(req, res) {
  const urlPath = decodeURIComponent(req.url.split("?")[0]);
  const rewrittenPath = (() => {
    if (urlPath === "/" || urlPath === "/index.html") return "/web/index.html";
    if (urlPath === "/story.html") return "/web/story.html";
    if (urlPath === "/library.html") return "/web/library.html";
    return urlPath;
  })();
  const filePath = safeJoin(root, rewrittenPath);
  if (!filePath) return send(res, 400, "Bad path");

  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) {
      return send(res, 404, "Not found");
    }
    const ext = path.extname(filePath).toLowerCase();
    const mime = mimeTypes[ext] || "application/octet-stream";
    const noCache = new Set([".html", ".css", ".js", ".json"]);
    fs.readFile(filePath, (readErr, data) => {
      if (readErr) return send(res, 500, "Failed to read file");
      const headers = { "Content-Type": mime };
      if (noCache.has(ext)) {
        headers["Cache-Control"] = "no-store, must-revalidate";
        headers["Pragma"] = "no-cache";
        headers["Expires"] = "0";
      }
      send(res, 200, data, headers);
    });
  });
}

function parseJson(req, res, callback) {
  let body = "";
  req.on("data", (chunk) => {
    body += chunk.toString();
    if (body.length > 10 * 1024 * 1024) {
      send(res, 413, "Payload too large");
      req.destroy();
    }
  });
  req.on("end", () => {
    try {
      const parsed = JSON.parse(body || "{}");
      callback(parsed);
    } catch (error) {
      send(res, 400, "Invalid JSON");
    }
  });
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function appendPlayerLogVerbatim(storyPath, text) {
  const logPath = path.join(storyPath, "log.json");
  let entries = [];
  try {
    const parsed = readJson(logPath);
    entries = Array.isArray(parsed) ? parsed : [];
  } catch {
    entries = [];
  }

  const lastEntry = entries[entries.length - 1];
  if (lastEntry && lastEntry.speaker === "Player" && lastEntry.text === text) {
    return logPath;
  }

  const maxTurn = entries.reduce((acc, entry) => {
    const turn = Number(entry && entry.turn);
    return Number.isFinite(turn) ? Math.max(acc, turn) : acc;
  }, 0);

  entries.push({
    turn: maxTurn + 1,
    speaker: "Player",
    text,
    timestamp: new Date().toISOString()
  });

  fs.writeFileSync(logPath, `${JSON.stringify(entries, null, 2)}\n`, "utf8");
  return logPath;
}

function getStoryPath(storyId) {
  const index = readJson(indexPath);
  const story = index.stories.find((entry) => entry.id === storyId);
  if (!story) return null;
  return path.join(root, story.path);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForLogUpdate(logPath, proc, timeoutMs = 120000) {
  let lastStat = null;
  try {
    lastStat = fs.statSync(logPath);
  } catch {
    lastStat = null;
  }

  const startedAt = Date.now();
  let sawChange = false;
  let changedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    await sleep(400);
    if (proc && proc.exitCode !== null) {
      return { ok: false, error: `Narrator process exited with code ${proc.exitCode}.` };
    }
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
      sawChange = true;
      changedAt = Date.now();
      lastStat = stat;
    }
    if (sawChange && Date.now() - changedAt > 1000) {
      return { ok: true };
    }
  }
  return { ok: false, error: "Timed out waiting for narration update." };
}

function ensureSession(storyId) {
  let session = sessions.get(storyId);
  if (session) {
    return session;
  }

  session = {
    queue: Promise.resolve(),
    lastUsed: Date.now()
  };
  sessions.set(storyId, session);
  return session;
}

async function runNarratorExec(storyId, storyPath, text) {
  const narrator = resolveNarratorCommand();
  if (!narrator) {
    throw new Error(narratorMissingMessage());
  }

  const relativePath = path.relative(root, storyPath).replace(/\\/g, "/");
  const prompt = [
    "You are the narrator. Read AGENTS.md in the repo root and follow it.",
    `Continue the story with id \"${storyId}\" located at \"${relativePath}\".`,
    "Treat data in that story folder as canon.",
    "The player's action for this turn has already been logged verbatim in log.json by the server.",
    "Do not edit or rewrite the player's text and do not append another Player log entry for this turn.",
    "Append narrator/NPC log entries and update story/characters/world/factions when relevant.",
    "Narration style: vivid, grounded, and dynamic like a strong tabletop GM.",
    "Every turn must introduce at least one NEW concrete development: a reaction, clue, threat, opportunity, cost, or environmental change.",
    "Do not just restate known facts. Prioritize what changes because of the player's action.",
    "Use sensory detail, NPC intent, and immediate stakes. Show motion in the world even if the player pauses.",
    "When new information appears, connect it to actionable next steps and tradeoffs the player could pursue.",
    "End the narrator turn with a direct prompt that invites a meaningful choice.",
    "Keep narration concise but evocative (about 1-3 short paragraphs).",
    "Keep narration in-world only. Do not append out-of-character recap blocks such as 'Current state: ...' in log text.",
    "Update recap.json each turn with current continuity: location, time, party status, NPCs present, open quests, immediate threats, unresolved choices, and recent changes.",
    "Do not change other stories.",
    "Write the actual narration into log.json. In stdout, return only a brief completion note.",
    "",
    `Exact player action: ${JSON.stringify(text)}`
  ].join("\n");

  const args = [
    ...narrator.baseArgs,
    "exec",
    prompt,
    "--skip-git-repo-check",
    "--dangerously-bypass-approvals-and-sandbox",
    "--output-last-message",
    "-"
  ];

  await new Promise((resolve, reject) => {
    const proc = spawn(narrator.command, args, {
      cwd: root,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true
    });

    let stderrTail = "";
    proc.stdout.on("data", (chunk) => {
      process.stdout.write(`[codex:${storyId}] ${chunk}`);
    });
    proc.stderr.on("data", (chunk) => {
      const textChunk = chunk.toString("utf8");
      process.stderr.write(`[codex:${storyId}][err] ${textChunk}`);
      stderrTail = `${stderrTail}${textChunk}`;
      if (stderrTail.length > 1200) {
        stderrTail = stderrTail.slice(-1200);
      }
    });

    proc.on("error", (error) => {
      reject(new Error(`Failed to launch narrator: ${error.message}`));
    });
    proc.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      const detail = stderrTail.trim();
      reject(new Error(`Narrator process exited with code ${code}.${detail ? ` Details: ${detail}` : ""}`));
    });
  });
}

async function handlePrompt(storyId, text) {
  const storyPath = getStoryPath(storyId);
  if (!storyPath) {
    throw new Error("Unknown story id.");
  }

  const logPath = appendPlayerLogVerbatim(storyPath, text);
  const session = ensureSession(storyId);
  session.lastUsed = Date.now();

  await runNarratorExec(storyId, storyPath, text);
  const result = await waitForLogUpdate(logPath, null, 5000);
  return result.ok;
}

function handlePromptRoute(req, res) {
  parseJson(req, res, async (payload) => {
    try {
      const storyId = String((payload && payload.storyId) || "").trim();
      const rawText = payload && payload.text;
      const text = typeof rawText === "string" ? rawText : String(rawText || "");
      if (!storyId || !text.trim()) {
        sendJson(res, 400, { ok: false, error: "Missing storyId or text." });
        return;
      }

      const session = ensureSession(storyId);
      const run = session.queue.then(() => handlePrompt(storyId, text));
      session.queue = run.catch(() => {});
      const updated = await run;
      sendJson(res, 200, { ok: true, updated });
    } catch (error) {
      sendJson(res, 500, { ok: false, error: error.message });
    }
  });
}

function handleUpload(req, res) {
  parseJson(req, res, (payload) => {
    const dataUrl = payload && payload.dataUrl;
    const originalName = payload && payload.filename;
    const theme = payload && payload.theme;
    const type = payload && payload.type;
    const id = payload && payload.id;
    const name = payload && payload.name;
    if (!dataUrl || typeof dataUrl !== "string") {
      return send(res, 400, "Missing dataUrl");
    }

    const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
    if (!match) {
      return send(res, 400, "Invalid data URL");
    }

    const mime = match[1];
    const data = match[2];
    const ext = mime === "image/jpeg" ? ".jpg" : mime === "image/png" ? ".png" : mime === "image/webp" ? ".webp" : mime === "image/gif" ? ".gif" : ".png";
    const safeTheme = (theme || "global").replace(/[^a-zA-Z0-9-_]/g, "");
    const safeType = (type || "image").replace(/[^a-zA-Z0-9-_]/g, "");
    const baseName = (name || id || originalName || "image").toString().replace(/[^a-zA-Z0-9-_]/g, "");
    const safeName = baseName || "image";
    const unique = crypto.randomBytes(6).toString("hex");
    const filename = `${safeName}-${safeTheme}-${unique}${ext}`;
    const themedUploadDir = path.join(uploadDir, safeTheme, safeType);
    const filePath = path.join(themedUploadDir, filename);
    console.log("Upload request:", { filename, filePath, mime, size: data.length });

    fs.mkdir(themedUploadDir, { recursive: true }, (dirErr) => {
      if (dirErr) {
        console.error("Upload dir error:", dirErr);
        return send(res, 500, "Failed to create upload directory");
      }
      fs.writeFile(filePath, Buffer.from(data, "base64"), (err) => {
        if (err) {
          console.error("Upload write error:", err);
          return send(res, 500, "Failed to write file");
        }
        const publicPath = `/assets/uploads/${safeTheme}/${safeType}/${filename}`;
        send(res, 200, JSON.stringify({ path: publicPath }), { "Content-Type": "application/json" });
      });
    });
  });
}

const server = http.createServer((req, res) => {
  if (req.method === "POST" && req.url === "/upload") {
    return handleUpload(req, res);
  }
  if (req.method === "POST" && req.url === "/api/prompt") {
    return handlePromptRoute(req, res);
  }
  if (req.method === "GET" && req.url === "/api/prompt") {
    return sendJson(res, 405, { ok: false, error: "Use POST /api/prompt with { storyId, text }." });
  }
  return serveStatic(req, res);
});

server.listen(8000, () => {
  console.log("Server running at http://localhost:8000");
});
