import { NextRequest, NextResponse } from 'next/server';

import { cleanHeaderDirectives } from './utils/server/headers-helpers';

export function middleware(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');

  const isDev = process.env.NODE_ENV === 'development';
  const ancestorsDirective = process.env.ALLOWED_IFRAME_ORIGINS
    ? 'frame-ancestors ' + process.env.ALLOWED_IFRAME_ORIGINS
    : 'frame-ancestors none';

  const frameSrcDirective = process.env.ALLOWED_IFRAME_SOURCES
    ? 'frame-src ' + process.env.ALLOWED_IFRAME_SOURCES
    : 'frame-src none';

  const cspHeader = `
    object-src 'none';
    base-uri 'self';
    script-src 'self' 'nonce-${nonce}' 'wasm-unsafe-eval' ${isDev ? "'unsafe-eval'" : ''};
    upgrade-insecure-requests;
    connect-src 'self';
    ${ancestorsDirective};
    ${frameSrcDirective};
`;
  // Replace newline characters and spaces
  const contentSecurityPolicyHeaderValue = cleanHeaderDirectives(cspHeader);

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);

  requestHeaders.set(
    'Content-Security-Policy',
    contentSecurityPolicyHeaderValue,
  );

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
  response.headers.set(
    'Content-Security-Policy',
    contentSecurityPolicyHeaderValue,
  );

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - _next/data (translation files)
     * - favicon.ico (favicon file)
     */
    {
      source: '/((?!api|_next/static|_next/image|_next/data|favicon.ico).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
};
