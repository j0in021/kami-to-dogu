const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');

const root = __dirname;
const handlers = {
  '/api/config': require('./api/config'),
  '/api/products': require('./api/products'),
  '/api/orders': require('./api/orders'),
  '/api/admin-orders': require('./api/admin-orders'),
};
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.jpg': 'image/jpeg', '.png': 'image/png' };

http.createServer(async (req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  res.status = code => { res.statusCode = code; return res; };
  res.json = value => { res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.end(JSON.stringify(value)); };
  if (handlers[pathname]) {
    try {
      if (req.method === 'POST' || req.method === 'PATCH') {
        let raw = '';
        for await (const chunk of req) {
          raw += chunk;
          if (raw.length > 65536) { res.status(413).json({ error: 'too_large' }); return; }
        }
        try { req.body = JSON.parse(raw || '{}'); }
        catch { res.status(400).json({ error: 'invalid_json' }); return; }
      }
      await handlers[pathname](req, res);
    } catch { if (!res.writableEnded) res.status(500).json({ error: 'internal_error' }); }
    return;
  }
  const file = pathname === '/' ? 'orange-stationery-store.html' : pathname === '/admin' ? 'admin.html' : pathname.slice(1);
  const resolved = path.resolve(root, file);
  if (!resolved.startsWith(root + path.sep) || !mime[path.extname(resolved)]) {
    res.statusCode = 404; res.end('Not found'); return;
  }
  try {
    const data = await fs.readFile(resolved);
    res.setHeader('Content-Type', mime[path.extname(resolved)]);
    res.end(data);
  } catch { res.statusCode = 404; res.end('Not found'); }
}).listen(Number(process.env.PORT || 4173), '127.0.0.1', () => {
  process.stdout.write(`Paper & Tools demo: http://127.0.0.1:${process.env.PORT || 4173}\n`);
});
