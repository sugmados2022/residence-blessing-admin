// Résidence Blessing Admin — serveur portable, Node.js, bibliothèque standard uniquement.
// Aucune dépendance npm, aucune étape de build.
// Variables d'environnement : PORT (défaut 3000), ADMIN_PASSWORD (si définie,
// l'écriture exige une session ; sinon l'écriture est libre et l'interface
// affiche un avertissement).
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = Number(process.env.PORT || 3000);
const DATA_FILE = path.join(__dirname, 'data.json');
const PUBLIC_DIR = path.join(__dirname, 'public');
const ASSETS_DIR = path.join(__dirname, 'assets');
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
const AUTH_REQUIRED = ADMIN_PASSWORD.length > 0;

// CORS : seules les routes /api/* sont exposées, et uniquement à ces deux origines.
const ALLOWED_ORIGINS = new Set([
  'https://residence-blessing.onrender.com',
  'http://localhost:3000',
]);

const sessions = new Set();

function safeEqual(a, b) {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

function parseCookies(req) {
  const out = {};
  const header = req.headers.cookie || '';
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

function isAuthenticated(req) {
  if (!AUTH_REQUIRED) return true;
  const token = parseCookies(req).session;
  return !!token && sessions.has(token);
}

function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) {
        reject(new Error('Corps trop volumineux'));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function sendJson(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(body);
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
};

function serveFile(res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Introuvable');
      return;
    }
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
}

// Empêche de sortir des dossiers autorisés.
function safeJoin(base, rel) {
  const target = path.normalize(path.join(base, rel));
  if (!target.startsWith(base + path.sep) && target !== base) return null;
  return target;
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    const pathname = url.pathname;

    // CORS pour les routes /api/* uniquement : origine autorisée reflétée,
    // preflight OPTIONS répondu sans passer par les gestionnaires de routes.
    if (pathname.startsWith('/api/')) {
      const origin = req.headers.origin || '';
      if (ALLOWED_ORIGINS.has(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Vary', 'Origin');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      }
      if (req.method === 'OPTIONS') {
        res.writeHead(204);
        return res.end();
      }
    }

    if (pathname === '/api/status') {
      return sendJson(res, 200, { authRequired: AUTH_REQUIRED, authenticated: isAuthenticated(req) });
    }

    if (pathname === '/api/login' && req.method === 'POST') {
      if (!AUTH_REQUIRED) return sendJson(res, 200, { ok: true, message: 'Aucun mot de passe défini.' });
      let body;
      try {
        body = JSON.parse(await readBody(req, 10000));
      } catch (e) {
        return sendJson(res, 400, { ok: false, error: 'Corps JSON invalide.' });
      }
      if (typeof body.password === 'string' && safeEqual(body.password, ADMIN_PASSWORD)) {
        const token = crypto.randomBytes(32).toString('hex');
        sessions.add(token);
        res.writeHead(200, {
          'Content-Type': 'application/json; charset=utf-8',
          'Set-Cookie': `session=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=86400`,
        });
        return res.end(JSON.stringify({ ok: true }));
      }
      return sendJson(res, 401, { ok: false, error: 'Mot de passe incorrect.' });
    }

    if (pathname === '/api/data' && req.method === 'GET') {
      return fs.readFile(DATA_FILE, 'utf8', (err, data) => {
        if (err) return sendJson(res, 500, { ok: false, error: 'Impossible de lire data.json.' });
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(data);
      });
    }

    if (pathname === '/api/data' && req.method === 'POST') {
      if (!isAuthenticated(req)) {
        return sendJson(res, 401, { ok: false, error: 'Connexion requise. Veuillez vous identifier.' });
      }
      let parsed;
      try {
        parsed = JSON.parse(await readBody(req, 2 * 1024 * 1024));
      } catch (e) {
        return sendJson(res, 400, { ok: false, error: 'Corps JSON invalide.' });
      }
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return sendJson(res, 400, { ok: false, error: 'Les données doivent être un objet JSON.' });
      }
      // Sauvegarde de sécurité avant écrasement.
      try {
        const current = fs.readFileSync(DATA_FILE);
        fs.writeFileSync(DATA_FILE + '.bak', current);
      } catch (e) { /* première écriture : pas de sauvegarde possible */ }
      fs.writeFile(DATA_FILE, JSON.stringify(parsed, null, 2) + '\n', 'utf8', (err) => {
        if (err) return sendJson(res, 500, { ok: false, error: 'Écriture impossible.' });
        return sendJson(res, 200, { ok: true });
      });
      return;
    }

    if (pathname === '/') return serveFile(res, path.join(PUBLIC_DIR, 'index.html'));
    if (pathname.startsWith('/assets/')) {
      const target = safeJoin(ASSETS_DIR, pathname.slice('/assets/'.length));
      if (!target) return sendJson(res, 400, { ok: false, error: 'Chemin invalide.' });
      return serveFile(res, target);
    }
    if (pathname.startsWith('/public/') || pathname === '/visitor.html') {
      const rel = pathname === '/visitor.html' ? 'visitor.html' : pathname.slice('/public/'.length);
      const target = safeJoin(PUBLIC_DIR, rel);
      if (!target) return sendJson(res, 400, { ok: false, error: 'Chemin invalide.' });
      return serveFile(res, target);
    }

    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Introuvable');
  } catch (e) {
    sendJson(res, 500, { ok: false, error: 'Erreur interne.' });
  }
});

server.listen(PORT, () => {
  console.log(`Résidence Blessing Admin en ligne sur http://localhost:${PORT}`);
  console.log(AUTH_REQUIRED
    ? 'Protection par mot de passe activée (ADMIN_PASSWORD définie).'
    : 'ATTENTION : aucun ADMIN_PASSWORD défini — l’écriture est libre. Ne pas exposer publiquement sans mot de passe.');
});
