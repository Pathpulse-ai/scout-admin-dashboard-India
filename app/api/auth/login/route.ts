import { NextRequest, NextResponse } from 'next/server';
import {
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
  createSessionToken,
  isAuthConfigured,
  isHttpsRequest,
  isPasswordCorrect,
} from '@/lib/auth';

/** Slows down password guessing without needing shared rate-limit state. */
const FAILED_ATTEMPT_DELAY_MS = 800;

export async function POST(request: NextRequest) {
  if (!isAuthConfigured()) {
    return NextResponse.json(
      { error: 'Password protection is not configured on the server.' },
      { status: 500 }
    );
  }

  let password = '';
  try {
    const body = await request.json() as { password?: unknown };
    if (typeof body.password === 'string') password = body.password;
  } catch {
    // Malformed body is treated as a wrong password.
  }

  if (!isPasswordCorrect(password)) {
    await new Promise((resolve) => setTimeout(resolve, FAILED_ATTEMPT_DELAY_MS));
    return NextResponse.json({ error: 'Incorrect password.' }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, createSessionToken(), {
    httpOnly: true,
    sameSite: 'lax',
    secure: isHttpsRequest(request),
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
  });
  return response;
}
