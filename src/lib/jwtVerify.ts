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

/** n8n must return these on success (plus valid: true). */
export interface JwtVerifySuccess {
  valid: true;
  employee_code: string;
  /** "web" | "app" */
  source: string;
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

    // Success = valid + employee_code + source (web | app) only
    if (data && data.valid === true) {
      const empRaw =
        data.employee_code ?? (data as { employeeCode?: string }).employeeCode;
      const srcRaw =
        data.source ?? (data as { Source?: string }).Source;
      const emp =
        empRaw != null && String(empRaw).trim() !== ''
          ? String(empRaw).trim()
          : '';
      const srcNorm = String(srcRaw ?? '')
        .trim()
        .toLowerCase();
      const sourceOk = srcNorm === 'web' || srcNorm === 'app';
      if (emp && sourceOk) {
        return {
          valid: true as const,
          employee_code: emp,
          source: srcNorm,
        };
      }
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
