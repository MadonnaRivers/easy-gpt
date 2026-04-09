/**
 * n8n JWT verify webhook — outbound auth (must match what n8n expects).
 * Body is always JSON { token } from server.mjs / Vite proxy.
 */
export const N8N_JWT_VERIFY_URL_DEFAULT =
  'https://n8n.easyhomefinance.in/webhook/verify_jwt';

export const N8N_JWT_VERIFY_AUTH_HEADER =
  'Basic Z2VuX2p3dDpFaGZsQGdlbl9qd3QxMjc4';

export const N8N_JWT_VERIFY_COOKIE_HEADER = 'easygpt_dashboard=1';

export function n8nJwtVerifyOutboundHeaders() {
  return {
    'Content-Type': 'application/json',
    Authorization: N8N_JWT_VERIFY_AUTH_HEADER,
    Cookie: N8N_JWT_VERIFY_COOKIE_HEADER,
  };
}
