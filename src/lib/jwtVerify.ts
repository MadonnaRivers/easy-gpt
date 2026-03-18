/**
 * JWT verification via n8n webhook.
 * Uses same-origin POST /api/verify-jwt (Node or Vite proxy) so n8n always receives the token
 * without browser CORS. Set VITE_JWT_VERIFY_WEBHOOK_URL only if you must call n8n directly.
 */

function jwtVerifyEndpoint(): string {
  const direct = import.meta.env.VITE_JWT_VERIFY_WEBHOOK_URL as string | undefined;
  if (direct?.trim()) return direct.trim();
  if (typeof window !== 'undefined') {
    return `${window.location.origin}/api/verify-jwt`;
  }
  return 'https://uat-n8n.easyhomefinance.in/webhook/verify_jwt';
}

export interface JwtVerifySuccess {
  valid: true;
  employee_code?: string;
  source?: string;
  [key: string]: unknown;
}

export interface JwtVerifyFailure {
  valid: false;
  error?: string;
  message?: string;
  [key: string]: unknown;
}

export type JwtVerifyResult = JwtVerifySuccess | JwtVerifyFailure;

/**
 * Verify JWT token with the n8n webhook. Returns the JSON response from the webhook.
 */
export async function verifyJwt(token: string): Promise<JwtVerifyResult> {
  const t = token?.trim();
  if (!t) {
    return { valid: false, error: 'invalid_token' };
  }

  try {
    const response = await fetch(jwtVerifyEndpoint(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ token: t }),
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        valid: false,
        error: data?.error ?? 'session_timed_out',
        message: data?.message ?? data?.error,
        ...data,
      };
    }

    // Webhook returns valid: true and user data (employee_code, source, etc.) on success
    if (data && data.valid === true) {
      const emp =
        data.employee_code ?? (data as { employeeCode?: string }).employeeCode;
      const src = data.source ?? (data as { Source?: string }).Source;
      return {
        ...data,
        valid: true as const,
        employee_code: emp != null ? String(emp) : undefined,
        source: src != null ? String(src) : undefined,
      };
    }

    return {
      valid: false,
      error: data?.error ?? 'session_timed_out',
      message: data?.message ?? data?.error,
      ...data,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return {
      valid: false,
      error: 'network_error',
      message,
    };
  }
}
