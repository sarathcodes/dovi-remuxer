import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { exec, execSync } from 'node:child_process';
import { probeMedia, executeRemux, cancelCurrentRemux, checkAllBinaries, setCustomBinaryPaths } from './engine.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = process.env.PORT || 4567;
const DIST_DIR = path.join(__dirname, 'dist');

// SSE clients
const sseClients = new Set();

function broadcastEvent(type, payload) {
  const message = `data: ${JSON.stringify({ type, payload })}\n\n`;
  for (const client of sseClients) {
    try {
      client.write(message);
    } catch {
      sseClients.delete(client);
    }
  }
}

// MIME types for static file serving
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
};

function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 10 * 1024 * 1024) {
        reject(new Error('Body too large'));
      }
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
  const pathname = parsedUrl.pathname;

  // CORS headers for local dev
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  // --- API Endpoints ---
  if (pathname === '/api/events' && req.method === 'GET') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });
    res.write('retry: 2000\n\n');
    sseClients.add(res);

    req.on('close', () => {
      sseClients.delete(res);
    });
    return;
  }

  if (pathname === '/api/binaries' && req.method === 'GET') {
    const status = checkAllBinaries();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(status));
  }

  if (pathname === '/api/binaries' && req.method === 'POST') {
    try {
      const paths = await parseJsonBody(req);
      setCustomBinaryPaths(paths);
      const status = checkAllBinaries();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify(status));
    } catch (err) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: err.message }));
    }
  }

  if (pathname === '/api/probe' && req.method === 'POST') {
    try {
      const { filePath } = await parseJsonBody(req);
      if (!filePath) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'filePath is required' }));
      }
      const data = await probeMedia(filePath);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify(data));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: err.message || String(err) }));
    }
  }

  if (pathname === '/api/remux' && req.method === 'POST') {
    try {
      const options = await parseJsonBody(req);
      const result = await executeRemux(
        options,
        (progress) => broadcastEvent('progress', progress),
        (log) => broadcastEvent('log', log)
      );
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify(result));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: err.message || String(err) }));
    }
  }

  if (pathname === '/api/cancel' && req.method === 'POST') {
    cancelCurrentRemux();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ cancelled: true }));
  }

  if (pathname === '/api/dialog/select-file' && req.method === 'POST') {
    try {
      let chosen = null;
      if (process.platform === 'darwin') {
        const appleScript = `osascript -e 'POSIX path of (choose file of type {"mkv", "mp4", "ts"} with prompt "Select 4K DoVi MKV File")' 2>/dev/null`;
        chosen = execSync(appleScript, { encoding: 'utf8' }).trim();
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ file: chosen }));
    } catch {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ file: null }));
    }
  }

  if (pathname === '/api/dialog/select-folder' && req.method === 'POST') {
    try {
      let chosen = null;
      if (process.platform === 'darwin') {
        const appleScript = `osascript -e 'POSIX path of (choose folder with prompt "Select Output Folder")' 2>/dev/null`;
        chosen = execSync(appleScript, { encoding: 'utf8' }).trim();
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ folder: chosen }));
    } catch {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ folder: null }));
    }
  }

  if (pathname === '/api/shell/show-item' && req.method === 'POST') {
    try {
      const { filePath } = await parseJsonBody(req);
      if (filePath) {
        if (process.platform === 'darwin') {
          exec(`open -R "${filePath}"`);
        } else if (process.platform === 'win32') {
          exec(`explorer.exe /select,"${filePath}"`);
        } else {
          exec(`xdg-open "${path.dirname(filePath)}"`);
        }
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: true }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: err.message }));
    }
  }

  // --- Static File Serving ---
  let filePath = path.join(DIST_DIR, pathname === '/' ? 'index.html' : pathname);

  if (!fs.existsSync(filePath)) {
    filePath = path.join(DIST_DIR, 'index.html');
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  try {
    const content = fs.readFileSync(filePath);
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(content);
  } catch (e) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  }
});

server.listen(PORT, () => {
  const url = `http://localhost:${PORT}`;
  console.log(`\n🚀 DoVi Remuxer Server running at: ${url}`);
  console.log(`💡 Drag & drop 4K DoVi MKV files or browse in your browser.`);
  console.log(`Press Ctrl+C to stop.\n`);

  // Auto-launch browser
  if (process.platform === 'darwin') {
    exec(`open ${url}`);
  } else if (process.platform === 'win32') {
    exec(`start ${url}`);
  } else {
    exec(`xdg-open ${url}`);
  }
});
