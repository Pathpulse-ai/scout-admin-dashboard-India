import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Shared-password gate for the whole console.
 *
 * DASHBOARD_PASSWORD is the one password everyone signs in with. A successful
 * sign-in gets an httpOnly cookie holding `<expiry>.<hmac>`, signed with
 * AUTH_SECRET. The password is folded into the signature, so changing either
 * env var signs everyone out.
 *
 * Fails closed: with either env var missing, nobody can sign in.
 */

export const SESSION_COOKIE = 'pathpulse_session';
export const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;

function authEnv() {
  const password = process.env.DASHBOARD_PASSWORD;
  const secret = process.env.AUTH_SECRET;
  return password && secret ? { password, secret } : null;
}

export function isAuthConfigured(): boolean {
  return authEnv() !== null;
}

function sign(expiresAt: number, env: { password: string; secret: string }): string {
  return createHmac('sha256', env.secret)
    .update(`v1.${expiresAt}.${env.password}`)
    .digest('hex');
}

/** Constant-time comparison that also hides the length of either input. */
function safeEqual(a: string, b: string): boolean {
  const digestA = createHash('sha256').update(a).digest();
  const digestB = createHash('sha256').update(b).digest();
  return timingSafeEqual(digestA, digestB);
}

export function isPasswordCorrect(candidate: string): boolean {
  const env = authEnv();
  if (!env) return false;
  return safeEqual(candidate, env.password);
}

export function createSessionToken(): string {
  const env = authEnv();
  if (!env) throw new Error('DASHBOARD_PASSWORD and AUTH_SECRET must be set');
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  return `${expiresAt}.${sign(expiresAt, env)}`;
}

export function isSessionValid(token: string | undefined): boolean {
  const env = authEnv();
  if (!env || !token) return false;

  const [rawExpiry, signature] = token.split('.');
  const expiresAt = Number(rawExpiry);
  if (!Number.isInteger(expiresAt) || !signature) return false;
  if (expiresAt <= Math.floor(Date.now() / 1000)) return false;

  return safeEqual(signature, sign(expiresAt, env));
}

/** Only mark the cookie Secure when the request actually arrived over HTTPS. */
export function isHttpsRequest(request: Request): boolean {
  return new URL(request.url).protocol === 'https:'
    || request.headers.get('x-forwarded-proto')?.split(',')[0].trim() === 'https';
}
