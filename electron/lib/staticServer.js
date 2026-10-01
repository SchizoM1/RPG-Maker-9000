// staticServer.js — minimal static file server bound to 127.0.0.1, used for
// playtests (so fetch/WebAudio behave like a web host) and for tests.
"use strict";

const http = require("http");
const fs = require("fs");
const path = require("path");

const MIME = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".mjs": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".svg": "image/svg+xml",
    ".ogg": "audio/ogg",
    ".m4a": "audio/mp4",
    ".mp3": "audio/mpeg",
    ".wav": "audio/wav",
    ".webm": "video/webm",
    ".mp4": "video/mp4",
    ".ttf": "font/ttf",
    ".otf": "font/otf",
    ".woff": "font/woff",
    ".woff2": "font/woff2",
    ".wasm": "application/wasm",
    ".efkefc": "application/octet-stream",
    ".txt": "text/plain; charset=utf-8"
};

function startStaticServer(rootDir, { port = 0, onRequest } = {}) {
    const root = path.resolve(rootDir);
    const server = http.createServer((req, res) => {
        if (onRequest && onRequest(req, res) === true) return;
        let urlPath;
        try {
            urlPath = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
        } catch (e) {
            res.writeHead(400);
            res.end();
            return;
        }
        if (urlPath.endsWith("/")) urlPath += "index.html";
        const file = path.resolve(root, "." + urlPath);
        if (!file.startsWith(root + path.sep) && file !== root) {
            res.writeHead(403);
            res.end();
            return;
        }
        fs.stat(file, (err, stat) => {
            if (err || !stat.isFile()) {
                res.writeHead(404, { "Content-Type": "text/plain" });
                res.end("Not found");
                return;
            }
            res.writeHead(200, {
                "Content-Type": MIME[path.extname(file).toLowerCase()] || "application/octet-stream",
                "Content-Length": stat.size,
                "Cache-Control": "no-store"
            });
            fs.createReadStream(file).pipe(res);
        });
    });
    return new Promise((resolve, reject) => {
        server.once("error", reject);
        server.listen(port, "127.0.0.1", () => {
            const address = server.address();
            resolve({ server, port: address.port, url: "http://127.0.0.1:" + address.port + "/" });
        });
    });
}

module.exports = { startStaticServer, MIME };
