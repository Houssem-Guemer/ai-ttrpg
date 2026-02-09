#!/usr/bin/env node
"use strict";

const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const root = path.resolve(__dirname, "..");
const uploadDir = path.join(root, "assets", "uploads");

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

function safeJoin(base, target) {
  const targetPath = path.normalize(path.join(base, target));
  if (!targetPath.startsWith(base)) return null;
  return targetPath;
}

function serveStatic(req, res) {
  const urlPath = decodeURIComponent(req.url.split("?")[0]);
  const filePath = safeJoin(root, urlPath === "/" ? "/web/index.html" : urlPath);
  if (!filePath) return send(res, 400, "Bad path");

  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) {
      return send(res, 404, "Not found");
    }
    const ext = path.extname(filePath).toLowerCase();
    const mime = mimeTypes[ext] || "application/octet-stream";
    fs.readFile(filePath, (readErr, data) => {
      if (readErr) return send(res, 500, "Failed to read file");
      send(res, 200, data, { "Content-Type": mime });
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

function handleUpload(req, res) {
  parseJson(req, res, (payload) => {
    const dataUrl = payload && payload.dataUrl;
    const originalName = payload && payload.filename;
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
    const safeName = (originalName || "image").replace(/[^a-zA-Z0-9-_]/g, "");
    const unique = crypto.randomBytes(6).toString("hex");
    const filename = `${safeName || "image"}-${unique}${ext}`;
    const filePath = path.join(uploadDir, filename);

    fs.writeFile(filePath, Buffer.from(data, "base64"), (err) => {
      if (err) return send(res, 500, "Failed to write file");
      const publicPath = `/assets/uploads/${filename}`;
      send(res, 200, JSON.stringify({ path: publicPath }), { "Content-Type": "application/json" });
    });
  });
}

const server = http.createServer((req, res) => {
  if (req.method === "POST" && req.url === "/upload") {
    return handleUpload(req, res);
  }
  return serveStatic(req, res);
});

server.listen(8000, () => {
  console.log("Server running at http://localhost:8000");
});
