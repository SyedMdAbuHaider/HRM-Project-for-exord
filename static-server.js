/**
 * static-server.js — Exord HRM static file server
 * Replaces `pm2 serve` to fix URIError crashes on malformed URLs.
 * Serves the Vite dist/ build with SPA fallback (all routes → index.html).
 */
import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);

const app  = express();
const PORT = process.env.PORT || 3000;
const DIST = join(__dirname, 'dist');

// Guard against malformed percent-encoded URLs — never crash the process
app.use((req, res, next) => {
  try {
    decodeURIComponent(req.path);
    next();
  } catch {
    res.status(400).send('Bad Request');
  }
});

// Static assets — long cache for hashed filenames, no-cache for index.html
app.use(express.static(DIST, {
  maxAge: '1y',
  immutable: true,
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('index.html')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    }
  },
}));

// SPA fallback — every unknown route serves index.html
app.get('/{*path}', (_req, res) => {
  res.sendFile(join(DIST, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Exord HRM serving ${DIST} on 0.0.0.0:${PORT}`);
});
