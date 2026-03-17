# Easy GPT — production deployment

## What you need on the server

| Requirement | Notes |
|-------------|--------|
| **Node.js** | **v18+** or **v20 LTS** (for `npm run build` only; you can build on CI and copy `dist/` if you prefer) |
| **Python** | **3.10+** (3.11/3.12 recommended) |
| **npm** | Comes with Node |

## One-time setup (on the server or build machine)

```bash
# 1) Clone
git clone https://github.com/MadonnaRivers/easy-gpt.git
cd easy-gpt

# 2) Frontend — install deps and build (outputs to dist/)
npm ci
npm run build

# 3) Python — virtual environment + server deps
python -m venv venv
# Windows:
venv\Scripts\activate
# Linux/macOS:
# source venv/bin/activate

pip install -r requirements-server.txt
```

## Run in production

From the project root (with `dist/` present and venv activated):

```bash
uvicorn server:app --host 0.0.0.0 --port 8000
```

- **App (chat):** `http://YOUR_SERVER:8000/` → enter predefined token, or open JWT link with `?jwt_token=...`
- **After predefined login:** chat at `http://YOUR_SERVER:8000/app/`
- **Dashboard (predefined only):** `http://YOUR_SERVER:8000/app/dashboard`

### Hardened / process manager (Linux example)

Use **systemd**, **supervisor**, or **gunicorn + uvicorn workers** behind **Nginx** (HTTPS, reverse proxy to `127.0.0.1:8000`).

Example Nginx location (serves API + static app via FastAPI):

```nginx
location / {
    proxy_pass http://127.0.0.1:8000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

## Re-deploy after code changes

```bash
git pull
npm ci
npm run build
# restart uvicorn (or your process manager)
```

## Do not commit

- `node_modules/`, `venv/`, `dist/` (rebuild on server), `.env` if you add secrets later.

## Predefined token

Configured in **`server.py`** (`VALID_TOKEN`). Change there and redeploy if needed.

JWT verification uses the n8n URL in **`src/lib/jwtVerify.ts`** — ensure production domains are allowed by n8n CORS if the browser calls it directly.
