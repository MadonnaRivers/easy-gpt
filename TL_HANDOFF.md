# Easy GPT — Handoff for TL

Single place for **how it runs**, **auth flow**, and **n8n webhooks**.

---

## What this is

- **Frontend:** React (Vite), served under **`/app/`** by a small **Node (Express)** server.
- **Server (`server.mjs`):** Landing page, predefined-token gate, static files, dashboard cookie, **JWT verify proxy** to n8n.
- **Chat & dashboard** call **n8n webhooks** on UAT.

---

## Run steps (production-style)

Copy-paste on the server:

```bash
git clone https://github.com/MadonnaRivers/easy-gpt.git
cd easy-gpt
npm ci
npm run build
npm start
```

- Default URL: **`http://SERVER_IP:8000`**
- Custom port (optional):

```bash
# Linux/macOS
export PORT=8080
npm start
```

```cmd
REM Windows
set PORT=8080
npm start
```

**After code updates:**

```bash
git pull
npm ci
npm run build
# restart npm start (or PM2/systemd)
```

**Requirements:** Node.js **18+** (20 LTS fine).

---

## URLs (after `npm start`)

| URL | Purpose |
|-----|--------|
| **`/`** | Landing — user enters **internal access token** → `POST /load` → redirect to chat |
| **`/app/`** | Easy GPT chat UI |
| **`/app/?jwt_token=...`** | User lands with JWT from admin portal → verify via n8n → then chat |
| **`/app/dashboard`** | Dashboard (internal/predefined path + cookie only; not for JWT-only users) |
| **`POST /api/verify-jwt`** | Not for browsers directly as primary flow — app calls this; server forwards JSON `{ "token": "..." }` to n8n |

---

## End-to-end: JWT → Easy GPT

1. **TL starts the app:** `npm run build` + `npm start` (port 8000 by default).

2. **Admin portal** sends user to Easy GPT with JWT in query string, e.g.  
   `https://your-host/app/?jwt_token=<JWT>`

3. **Browser** calls **`POST /api/verify-jwt`** on **same host** (no CORS to n8n from browser).

4. **Node server** forwards to n8n (secured like your curl):

   **`POST`** to **`N8N_JWT_VERIFY_URL`** (default: UAT **`/webhook/verify_jwt`**)  
   **Body:** `{ "token": "<JWT>" }`  
   **Headers to n8n:** `Content-Type: application/json`, **`Authorization: Basic …`**, **`Cookie: easygpt_dashboard=1`** — defined in **`n8nJwtVerifyAuth.mjs`** (used by **`server.mjs`**; optional URL override: env **`N8N_JWT_VERIFY_URL`**).

5. **n8n** returns JSON. App allows access only if **`valid: true`**, **`employee_code`** (non-empty), and **`source`** is **`web`** or **`app`** (case-insensitive). No other fields are required.

6. **Success:** Token removed from URL; `employee_code` / `source` stored locally; user uses chat.  
   **Failure:** “Session timed out” page.

**Override n8n URL (optional):**

```bash
set N8N_JWT_VERIFY_URL=https://other-host/webhook/verify_jwt
npm start
```

---

## End-to-end: Internal token → Easy GPT (+ dashboard)

1. User opens **`/`**, submits the **internal token** (configured in `server.mjs` as `VALID_TOKEN`, not documented here).

2. **`POST /load`** — valid token → **303** to **`/app/?access=predefined`**, sets **httpOnly cookie** for dashboard.

3. User gets chat + **Dashboard** link (JWT-only users do **not** get dashboard).

---

## Chat (messages to n8n)

- **Webhook:**  
  `https://uat-n8n.easyhomefinance.in/webhook/edf7c50a-2d5f-4e1e-b070-1e4de62e098e`
- **POST body (JSON):** `sessionId`, `chatInput`, `employee_code`, `source`, `action: 'sendMessage'`
- **New Chat** generates a **new `sessionId`**; same chat reuses the same `sessionId` for all messages in that thread.

---

## Dashboard (n8n data + upload)

| Use | Method | Webhook |
|-----|--------|---------|
| Conversations list | GET | `.../webhook/f5c7f525-6af7-47d4-b080-715892d350f6` |
| Messages | GET | `.../webhook/48a93076-1569-4e6d-8a2b-d773ef94655b` |
| File upload | POST (multipart) | `.../webhook/bfeed288-3ed4-4428-9b28-b39842289d3c` |

---

## Postman — test JWT verify on n8n

- **POST** your verify URL (e.g. `…/webhook/verify_jwt`)
- **Headers:** `Content-Type: application/json`, `Authorization: Basic …`, `Cookie: easygpt_dashboard=1` (same values as **`n8nJwtVerifyAuth.mjs`**)
- **Body (raw JSON):** `{ "token": "<paste-jwt>" }`
- Or **POST** `http://your-server:8000/api/verify-jwt` with **`Content-Type: application/json`** and body `{ "token": "..." }` — the app server adds Basic + Cookie to the n8n request.

---

## Security note (for TL)

- First load with **`?jwt_token=`** exposes JWT in the URL briefly until stripped; consider future **POST + cookie** or **one-time code** if policy requires.

---

## Repo

**GitHub:** `https://github.com/MadonnaRivers/easy-gpt` (branch `main`).

More detail: **`DEPLOYMENT.md`**.
