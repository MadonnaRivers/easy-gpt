# Easy GPT — production deployment

## Production steps (copy-paste)

```bash
git clone https://github.com/MadonnaRivers/easy-gpt.git
cd easy-gpt
npm ci
npm run build
npm start
```

Server listens on **port 8000** by default (`http://SERVER_IP:8000`).

**Linux — custom port (optional):**

```bash
export PORT=8080
export HOST=0.0.0.0
npm start
```

**Windows — custom port (optional):**

```cmd
set PORT=8080
set HOST=0.0.0.0
npm start
```

Run **`npm start`** under **PM2**, **systemd**, or **Docker** so it restarts on reboot. Put **Nginx** (or similar) in front with **HTTPS** and proxy to `127.0.0.1:8000`.

## Requirements

- **Node.js 18+** (20 LTS recommended)
- **npm** (comes with Node)

| URL | Purpose |
|-----|--------|
| `/` | Landing → predefined token |
| `/app/` | Chat |
| `/app/?jwt_token=...` | JWT flow |
| `/app/dashboard` | Dashboard (predefined / cookie) |

## Re-deploy

```bash
git pull
npm ci
npm run build
# restart `npm start` (or PM2/systemd)
```

## Nginx (example)

```nginx
location / {
    proxy_pass http://127.0.0.1:8000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

## Config

- Predefined token: **`server.mjs`** → `VALID_TOKEN`
- JWT webhook: **`src/lib/jwtVerify.ts`**

Do not commit `node_modules/`, `dist/` (rebuild on server).
