import { NextRequest, NextResponse, connection } from 'next/server';

import { cleanHeaderDirectives } from './utils/server/headers-helpers';

export async function middleware(request: NextRequest) {
  await connection();

  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');

  const isDev = process.env.NODE_ENV === 'development';
  const ancestorsDirective = process.env.ALLOWED_IFRAME_ORIGINS
    ? 'frame-ancestors ' + process.env.ALLOWED_IFRAME_ORIGINS
    : 'frame-ancestors none';

  const frameSrcDirective = process.env.ALLOWED_IFRAME_SOURCES
    ? 'frame-src ' + process.env.ALLOWED_IFRAME_SOURCES
    : 'frame-src none';

  const cspHeader = `
    default-src 'self';
    script-src 'self' 'nonce-${nonce}' 'strict-dynamic' ${isDev ? 'unsafe-eval' : ''};
    style-src 'self' 'unsafe-inline';
    img-src 'self' https://authjs.dev/img/providers/;
    upgrade-insecure-requests;
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
  // matcher: '/(.*)',
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
