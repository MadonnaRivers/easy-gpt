/**
 * Node server (replaces Python FastAPI): landing, /load token gate, static /app, dashboard cookie API.
 * Run: npm run build && node server.mjs
 * Env: PORT (default 8002), HOST (default 0.0.0.0)
 *       N8N_JWT_VERIFY_URL — optional override for n8n JWT webhook URL
 */

import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import {
  N8N_JWT_VERIFY_URL_DEFAULT,
  n8nJwtVerifyOutboundHeaders,
} from './n8nJwtVerifyAuth.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distPath = path.join(__dirname, 'dist');
const distReady = fs.existsSync(path.join(distPath, 'index.html'));

const VALID_TOKEN = '24681379';
const DASHBOARD_COOKIE = 'easygpt_dashboard';

/** Forward JWT verify here so the browser never calls n8n directly (CORS). */
const N8N_JWT_VERIFY_URL =
  process.env.N8N_JWT_VERIFY_URL || N8N_JWT_VERIFY_URL_DEFAULT;

const SESSION_TIMEOUT_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Session timed out</title>
  <style>
    body { font-family: system-ui, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #1a1a2e; color: #eee; }
    .box { text-align: center; padding: 2rem; border: 1px solid #333; border-radius: 8px; }
    h1 { color: #e74c3c; }
  </style>
</head>
<body>
  <div class="box">
    <h1>Session timed out</h1>
  </div>
</body>
</html>`;

const LANDING_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Easy GPT – Enter token</title>
  <style>
    body { font-family: system-ui, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #1a1a2e; color: #eee; }
    .box { text-align: center; padding: 2rem; border: 1px solid #333; border-radius: 8px; }
    input { padding: 0.5rem 1rem; margin: 0.5rem 0; width: 12rem; }
    button { padding: 0.5rem 1.5rem; margin-left: 0.5rem; cursor: pointer; background: #3498db; color: #fff; border: none; border-radius: 4px; }
    button:hover { background: #2980b9; }
  </style>
</head>
<body>
  <div class="box">
    <h1>Easy GPT</h1>
    <p>Enter your token to continue.</p>
    <form action="/load" method="post">
      <input type="text" name="token" placeholder="Token" required autofocus />
      <button type="submit">Go</button>
    </form>
  </div>
</body>
</html>`;

const app = express();
app.use(
  cors({
    origin: ['http://127.0.0.1:3000', 'http://localhost:3000'],
    credentials: true,
  })
);
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Avoid 500 when body is not valid JSON (e.g. bad curl / proxy); return 400 instead.
app.use((err, req, res, next) => {
  if (err && err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'invalid_json', message: 'Request body must be valid JSON' });
  }
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({ error: 'invalid_json', message: 'Request body must be valid JSON' });
  }
  next(err);
});

app.get('/api/dashboard-access', (req, res) => {
  res.json({ dashboard: req.cookies[DASHBOARD_COOKIE] === '1' });
});

app.post('/api/verify-jwt', async (req, res) => {
  const token =
    req.body && typeof req.body.token === 'string' ? req.body.token.trim() : '';
  if (!token) {
    return res.status(400).json({ valid: false, error: 'invalid_token' });
  }
  try {
    const r = await fetch(N8N_JWT_VERIFY_URL, {
      method: 'POST',
      headers: n8nJwtVerifyOutboundHeaders(),
      body: JSON.stringify({ token }),
    });
    const text = await r.text();
    let data;
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      return res
        .status(502)
        .json({ valid: false, error: 'bad_response', message: 'n8n did not return JSON' });
    }
    res.status(r.status).json(data);
  } catch (e) {
    res.status(502).json({
      valid: false,
      error: 'network_error',
      message: e instanceof Error ? e.message : String(e),
    });
  }
});

app.post('/load', (req, res) => {
  let token = '';
  if (req.is('application/json') && req.body && typeof req.body === 'object') {
    token = String(req.body.token ?? '');
  } else {
    token = String(req.body?.token ?? '');
  }
  token = token.trim();
  if (token === VALID_TOKEN) {
    res.cookie(DASHBOARD_COOKIE, '1', {
      maxAge: 7 * 24 * 3600 * 1000,
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
    });
    return res.redirect(303, '/app/?access=predefined');
  }
  res.status(200).type('html').send(SESSION_TIMEOUT_HTML);
});

app.get('/', (_req, res) => {
  res.type('html').send(LANDING_HTML);
});

app.get('/favicon.ico', (_req, res) => {
  res.status(204).end();
});

if (distReady) {
  app.use('/app', express.static(distPath));
  app.get('/app', (_req, res) => res.redirect(301, '/app/'));
  app.use('/app', (_req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
} else {
  const missing = `<p>Run <code>npm run build</code> first, then restart the server.</p>`;
  app.get(['/app', '/app/'], (_req, res) => res.status(503).type('html').send(missing));
  app.get(/^\/app\/.*/, (_req, res) => res.status(503).type('html').send(missing));
}

const PORT = Number(process.env.PORT) || 8002;
const HOST = process.env.HOST || '0.0.0.0';

app.listen(PORT, HOST, () => {
  console.log(`Easy GPT server http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}`);
  if (!distReady) console.warn('No dist/ — run npm run build');
});
