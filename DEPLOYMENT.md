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
| `POST /api/verify-jwt` | Internal: forwards `{ token }` to n8n `…/webhook/verify_jwt` |

## How to run

1. **Production (real users)**  
   `npm ci` → `npm run build` → `npm start`  
   Open **`http://YOUR_SERVER:8000`**. The Node app is the only “API” you start; it serves the static chat app and proxies JWT verify to n8n.

2. **Local frontend only (hot reload)**  
   `npm run dev` (port 3000). Chat/JWT still work if n8n and `/api/verify-jwt` proxy are reachable; dashboard cookie checks may need the Node server on 8000 running too.

## End-to-end: JWT → Easy GPT

1. **Start the app** — Run **`npm start`** (after **`npm run build`**). The server listens on port **8000** (by default).

2. **User arrives with a JWT** — Your admin portal (or a link) sends the user to Easy GPT with the token in the query string, e.g.  
   **`https://your-server/app/?jwt_token=THE_JWT`**

3. **Verification** — The React app calls **`POST /api/verify-jwt`** on **your server** (same origin) with body **`{ "token": "THE_JWT" }`**. The server forwards that to n8n:  
   **`https://n8n.easyhomefinance.in/webhook/verify_jwt`** (or whatever you set in **`N8N_JWT_VERIFY_URL`**).

4. **n8n responds** — Access only if **`valid: true`**, non-empty **`employee_code`**, and **`source`** is **`web`** or **`app`**. Those two values are stored; then `jwt_token` is removed from the URL. Otherwise **Session timed out**.

5. **Predefined access (optional)** — Users can instead open **`/`**, submit the internal token → redirect to **`/app/?access=predefined`** (dashboard allowed for that path). This path does **not** call the JWT webhook.

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
- JWT verify: browser → **`POST /api/verify-jwt`** → server forwards **`{ token }`** to n8n with **`Authorization`** + **`Cookie`** (see **`n8nJwtVerifyAuth.mjs`**). Optional URL override: **`N8N_JWT_VERIFY_URL`**.

Do not commit `node_modules/`, `dist/` (rebuild on server).
