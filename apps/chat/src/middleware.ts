import { JWT, getToken } from 'next-auth/jwt';
import type {
  NextAuthMiddlewareOptions,
  NextMiddlewareWithAuth,
  WithAuthArgs,
} from 'next-auth/middleware';
import type { NextMiddleware, NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { DEFAULT_PROVIDER } from './utils/auth/auth-providers';

async function hash(value: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(value);
  const hash = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hash));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

interface AuthMiddlewareOptions extends NextAuthMiddlewareOptions {
  trustHost?: boolean;
}

async function handleMiddleware(
  req: NextRequest,
  options: AuthMiddlewareOptions | undefined = {},
  onSuccess?: (token: JWT | null) => ReturnType<NextMiddleware>,
) {
  const errorPage = options?.pages?.error ?? '/api/auth/error';

  options.trustHost ??= !!process.env.NEXTAUTH_URL;

  let host =
    process.env.NEXTAUTH_URL ??
    req.headers?.get('x-forwarded-host') ??
    'localhost:3000';

  if (!host.startsWith('http://') && !host.startsWith('https://')) {
    host = `http://${host}`;
  }

  const token = await getToken({
    req,
    decode: options.jwt?.decode,
    cookieName: options?.cookies?.sessionToken?.name,
    secret: options.secret,
  });

  const isAuthorized =
    (await options?.callbacks?.authorized?.({ req, token })) ?? !!token;

  if (isAuthorized) return onSuccess?.(token);

  if (!DEFAULT_PROVIDER) {
    return NextResponse.next();
  }

  try {
    const cookieCsrfToken = req.cookies.get('next-auth.csrf-token')?.value;
    const csrfToken = cookieCsrfToken?.split('|')?.[0] ?? '';
    const csrfTokenHash =
      cookieCsrfToken?.split('|')?.[1] ??
      (await hash(`${csrfToken}${options.secret}`));
    const cookie = `${csrfToken}|${csrfTokenHash}`;

    const requestUrl = `${host}/api/auth/signin/${DEFAULT_PROVIDER}`;

    const res = await fetch(requestUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-Auth-Return-Redirect': '1',
        cookie: `next-auth.csrf-token=${cookie}`,
      },
      credentials: 'include',
      redirect: 'follow',
      body: new URLSearchParams({
        csrfToken,
        callbackUrl: req.url,
        json: 'true',
      }),
    });

    if (!res.ok) {
      throw new Error(`Failed to fetch: ${res.status} ${res.statusText}`);
    }

    const data = await res.json();

    return NextResponse.redirect(data.url, {
      headers: {
        'Set-Cookie': res.headers.get('set-cookie') ?? '',
      },
    });
  } catch (error) {
    return NextResponse.redirect(errorPage);
  }
}

export function withAuth(...args: WithAuthArgs) {
  if (!args.length || args[0] instanceof Request) {
    return handleMiddleware(...(args as Parameters<typeof handleMiddleware>));
  }

  if (typeof args[0] === 'function') {
    const middleware = args[0];
    const options = args[1] as NextAuthMiddlewareOptions | undefined;
    return async (...args: Parameters<NextMiddlewareWithAuth>) =>
      await handleMiddleware(args[0], options, async (token) => {
        args[0].nextauth = { token };
        return middleware(...args);
      });
  }

  const options = args[0];
  return (...args: Parameters<NextMiddleware>) =>
    handleMiddleware(args[0], options);
}

export default withAuth({});

export const config = {
  matcher: ['/', '/((?!api/auth|_next|public|favicon.ico|logo.svg).*)'],
  /**
   * https://github.com/lodash/lodash/issues/5862
   **/
  unstable_allowDynamic: ['**/node_modules/lodash-es/**/*.js'],
};
