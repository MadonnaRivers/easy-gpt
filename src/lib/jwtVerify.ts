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
  return 'https://n8n.easyhomefinance.in/webhook/verify_jwt';
}



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

    // Allow only when response matches expected payload structure.
    const hasError =
      data &&
      typeof data === 'object' &&
      'error' in (data as Record<string, unknown>) &&
      String((data as { error?: unknown }).error ?? '').trim() !== '';
    if (data && typeof data === 'object' && !hasError) {
      const payload = (data as { payload?: unknown }).payload;
      const okPayload =
        payload != null &&
        typeof payload === 'object' &&
        typeof (payload as { unique_code?: unknown }).unique_code === 'string' &&
        String((payload as { unique_code?: string }).unique_code ?? '').trim() !== '' &&
        typeof (payload as { iat?: unknown }).iat === 'number' &&
        typeof (payload as { exp?: unknown }).exp === 'number' &&
        (payload as { iss?: unknown }).iss === 'easyhomefinance.in' &&
        (payload as { aud?: unknown }).aud === 'internal-api' &&
        (payload as { sub?: unknown }).sub === 'user-auth';

      if (!okPayload) {
        return {
          valid: false,
          error: 'session_timed_out',
          message: 'Invalid JWT payload',
        };
      }
      return {
        valid: true as const,
        employee_code: 'JWT_USER',
        source: 'web',
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
