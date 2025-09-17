import { NextRequest, NextResponse } from 'next/server';

import {
  cleanHeaderDirectives,
  getFrameContentSecurityPolicyDirectives,
} from './utils/server/headers-helpers';

import { HeadersNames } from './constants/server';

export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');

  const isDev = process.env.NODE_ENV === 'development';
  const shouldIgnoreFrameOptions =
    path === '/auth/signin' || path === '/api/auth/signin';

  const frameDirectives = getFrameContentSecurityPolicyDirectives(
    process.env.ALLOWED_IFRAME_ORIGINS,
    process.env.ALLOWED_IFRAME_SOURCES,
    shouldIgnoreFrameOptions,
  );

  const cspHeader = `
    object-src 'none';
    base-uri 'self';
    script-src ${process.env.ALLOWED_IFRAME_ORIGINS} ${process.env.ALLOWED_IFRAME_SOURCES}
     https://cdn.jsdelivr.net/npm/monaco-editor@0.43.0/
     'nonce-${nonce}' 'wasm-unsafe-eval' ${isDev ? "'unsafe-eval'" : ''};
    ${frameDirectives}
`;
  // Replace newline characters and spaces
  const contentSecurityPolicyHeaderValue = cleanHeaderDirectives(cspHeader);

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);

  requestHeaders.set(
    HeadersNames.CONTENT_SECURITY_POLICY,
    contentSecurityPolicyHeaderValue,
  );

  if (
    !process.env.ALLOWED_IFRAME_ORIGINS &&
    !process.env.ALLOWED_IFRAME_SOURCES
  ) {
    requestHeaders.set('X-Frame-Options', 'SAMEORIGIN');
  }

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
  response.headers.set(
    HeadersNames.CONTENT_SECURITY_POLICY,
    contentSecurityPolicyHeaderValue,
  );
  if (
    !process.env.ALLOWED_IFRAME_ORIGINS &&
    !process.env.ALLOWED_IFRAME_SOURCES
  ) {
    response.headers.set('X-Frame-Options', 'SAMEORIGIN');
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    {
      source: '/((?!api|_next/static|_next/image|favicon.ico).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
};
