"""
Simple FastAPI server for testing: token in body.
- POST /load with body {"token": "..."} → valid token "24681379" → redirect to Easy GPT app; else session timed out page.
- Serves built app at /app (run npm run build first).
- Does NOT touch n8n webhook JWT verification.

Run: uvicorn server:app --reload --host 0.0.0.0 --port 8000

Curl (valid token → 302 to /app/; invalid → 200 + session timed out HTML):
  curl -X POST http://localhost:8000/load -H "Content-Type: application/json" -d "{\"token\":\"24681379\"}" -v
  curl -X POST http://localhost:8000/load -H "Content-Type: application/json" -d "{\"token\":\"wrong\"}" -v

To fetch the Easy GPT page after valid token (follow redirect):
  curl -L -X POST http://localhost:8000/load -H "Content-Type: application/json" -d "{\"token\":\"24681379\"}"
"""

from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, JSONResponse, RedirectResponse, Response
from fastapi.staticfiles import StaticFiles

# Predefined test token (for playing around)
VALID_TOKEN = "24681379"
DASHBOARD_COOKIE = "easygpt_dashboard"

app = FastAPI(title="Easy GPT test server")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://127.0.0.1:3000", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
dist = Path(__file__).parent / "dist"


@app.get("/api/dashboard-access")
def dashboard_access(request: Request):
    """Dashboard allowed only after login with predefined token (cookie set on /load)."""
    allowed = request.cookies.get(DASHBOARD_COOKIE) == "1"
    return JSONResponse({"dashboard": allowed})


SESSION_TIMEOUT_HTML = """<!DOCTYPE html>
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
    <p>Your token was invalid or expired. Please try again.</p>
  </div>
</body>
</html>
"""


@app.post("/load")
async def load_with_token(request: Request):
    """Accept token in JSON body or form. Valid token '24681379' → 303 redirect to /app/ (browser follows with GET)."""
    content_type = request.headers.get("content-type", "")
    if "application/json" in content_type:
        try:
            body = await request.json()
            token = (body or {}).get("token", "")
        except Exception:
            token = ""
    else:
        form = await request.form()
        token = form.get("token", "")
    token = (token or "").strip()
    if token == VALID_TOKEN:
        r = RedirectResponse(url="/app/?access=predefined", status_code=303)
        r.set_cookie(
            key=DASHBOARD_COOKIE,
            value="1",
            max_age=7 * 24 * 3600,
            path="/",
            httponly=True,
            samesite="lax",
        )
        return r
    return HTMLResponse(content=SESSION_TIMEOUT_HTML, status_code=200)


# Landing page: open http://localhost:8000/ in browser, enter token, submit → 303 redirect to /app/
LANDING_HTML = """<!DOCTYPE html>
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
    <p style="margin-top:1rem;font-size:0.9rem;color:#888;">Test token: 24681379</p>
  </div>
</body>
</html>
"""


@app.get("/")
def landing():
    return HTMLResponse(content=LANDING_HTML)


@app.get("/favicon.ico")
def favicon():
    return Response(status_code=204)


# Serve built Easy GPT app at /app (must run npm run build first)
if dist.exists() and (dist / "index.html").exists():
    app.mount("/app", StaticFiles(directory=str(dist), html=True), name="app")
else:
    @app.get("/app/")
    @app.get("/app")
    def app_missing():
        return HTMLResponse(
            content="<p>Run <code>npm run build</code> first, then restart the server.</p>",
            status_code=503,
        )
