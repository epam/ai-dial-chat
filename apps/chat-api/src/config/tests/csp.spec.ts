import { Controller, Get, INestApplication, Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import {
  buildDownloadFrameAncestorsDirective,
  buildFrameAncestorsDirective,
  buildFrameSrcDirective,
  buildPermissionsPolicyHeader,
  createHelmetOptions,
  createHtmlPreviewCspHeader,
  extractOrigin,
  isOriginAllowedForIframe,
} from '../csp';

@Controller('ping')
class PingController {
  @Get()
  ping() {
    return { ok: true };
  }
}

const createTestApp = async (
  allowedIframeOrigins: string[],
  secureTransport = true,
  cspOptions?: Parameters<typeof createHelmetOptions>[2],
): Promise<INestApplication> => {
  @Module({ controllers: [PingController] })
  class CspTestModule {}

  const app = await NestFactory.create(CspTestModule, { logger: false });
  /* The app declarations use Helmet's CJS types; Vitest resolves its ESM types. */
  app.use(
    helmet(
      createHelmetOptions(
        allowedIframeOrigins,
        secureTransport,
        cspOptions,
      ) as Parameters<typeof helmet>[0],
    ),
  );
  await app.init();
  await app.listen(0, '127.0.0.1');
  return app;
};

describe('buildFrameSrcDirective', () => {
  it('always includes self plus configured origins', () => {
    expect(buildFrameSrcDirective(['https://partner.example.com'])).toEqual([
      "'self'",
      'https://partner.example.com',
    ]);
  });

  it('includes only self when no origins are configured', () => {
    expect(buildFrameSrcDirective([])).toEqual(["'self'"]);
  });
});

describe('buildFrameAncestorsDirective', () => {
  it('denies all embedding when the allowlist is empty', () => {
    expect(buildFrameAncestorsDirective([])).toEqual(["'none'"]);
  });

  it('returns the configured origins verbatim, without adding self', () => {
    expect(
      buildFrameAncestorsDirective(['https://partner.example.com']),
    ).toEqual(['https://partner.example.com']);
  });
});

describe('buildPermissionsPolicyHeader', () => {
  it('delegates to self only when the allowlist is empty', () => {
    expect(buildPermissionsPolicyHeader([])).toBe(
      'local-network-access=(self)',
    );
  });

  it('delegates to self plus a single allowlisted origin', () => {
    expect(
      buildPermissionsPolicyHeader(['https://quickapps.example.com']),
    ).toBe('local-network-access=(self https://quickapps.example.com)');
  });

  it('delegates to self plus every allowlisted origin', () => {
    expect(
      buildPermissionsPolicyHeader([
        'https://quickapps.example.com',
        'https://skills.example.com',
      ]),
    ).toBe(
      'local-network-access=(self https://quickapps.example.com https://skills.example.com)',
    );
  });
});

describe('Helmet security headers', () => {
  let app: INestApplication | undefined;

  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  it('keeps cross-origin OAuth popup references observable by the opener', async () => {
    app = await createTestApp([]);
    const response = await request(app.getHttpServer())
      .get('/ping')
      .expect(200);

    expect(response.headers['cross-origin-opener-policy']).toBe(
      'same-origin-allow-popups',
    );
  });

  it('allows OOXML WebAssembly parsers without enabling JavaScript eval', async () => {
    app = await createTestApp([], true, { allowWasm: true });
    const response = await request(app.getHttpServer())
      .get('/ping')
      .expect(200);

    expect(response.headers['content-security-policy']).toContain(
      "script-src 'self' 'wasm-unsafe-eval'",
    );
    expect(response.headers['content-security-policy']).not.toContain(
      "'unsafe-eval'",
    );
  });

  it('does not allow inline code or WebAssembly on generic responses', async () => {
    app = await createTestApp([]);
    const response = await request(app.getHttpServer())
      .get('/ping')
      .expect(200);
    const policy = response.headers['content-security-policy'];
    expect(policy).not.toMatch(
      /'unsafe-inline'|'unsafe-eval'|'wasm-unsafe-eval'/,
    );
    expect(policy).toContain("script-src-attr 'none'");
    expect(policy).toContain("style-src-attr 'none'");
    expect(policy).toContain("object-src 'none'");
    expect(policy).toContain("base-uri 'self'");
  });

  it('allows the approved style nonce without authorizing inline scripts', async () => {
    app = await createTestApp([], true, { nonce: 'approved-nonce' });
    const response = await request(app.getHttpServer())
      .get('/ping')
      .expect(200);
    const directives = response.headers['content-security-policy'].split(';');
    expect(directives).toContain("script-src 'self'");
    expect(directives).toContain(
      "style-src 'self' https://fonts.googleapis.com 'nonce-approved-nonce'",
    );
  });

  it("sends frame-ancestors 'none' and keeps X-Frame-Options when the allowlist is empty", async () => {
    app = await createTestApp([]);
    const response = await request(app.getHttpServer())
      .get('/ping')
      .expect(200);

    expect(response.headers['content-security-policy']).toContain(
      "frame-ancestors 'none'",
    );
    expect(response.headers['x-frame-options']).toBe('SAMEORIGIN');
  });

  it('allows the configured origin and drops X-Frame-Options when the allowlist is non-empty', async () => {
    app = await createTestApp(['https://partner.example.com']);
    const response = await request(app.getHttpServer())
      .get('/ping')
      .expect(200);

    expect(response.headers['content-security-policy']).toContain(
      'frame-ancestors https://partner.example.com',
    );
    expect(response.headers['x-frame-options']).toBeUndefined();
  });

  it('enforces HTTPS transport by default', async () => {
    app = await createTestApp([]);
    const response = await request(app.getHttpServer())
      .get('/ping')
      .expect(200);

    expect(response.headers['content-security-policy']).toContain(
      'upgrade-insecure-requests',
    );
    expect(response.headers['strict-transport-security']).toBe(
      'max-age=31536000; includeSubDomains; preload',
    );
  });

  it('sends a referrer policy that keeps the origin visible cross-site', async () => {
    app = await createTestApp([]);
    const response = await request(app.getHttpServer())
      .get('/ping')
      .expect(200);

    expect(response.headers['referrer-policy']).toBe(
      'strict-origin-when-cross-origin',
    );
  });

  it('allows local HTTP transport when secure transport is disabled', async () => {
    app = await createTestApp([], false);
    const response = await request(app.getHttpServer())
      .get('/ping')
      .expect(200);

    expect(response.headers['content-security-policy']).not.toContain(
      'upgrade-insecure-requests',
    );
    expect(response.headers['strict-transport-security']).toBeUndefined();
  });
});

describe('createHtmlPreviewCspHeader', () => {
  it('allows inline scripts and styles without a nonce requirement, and does not widen script-src beyond inline', () => {
    const directives = createHtmlPreviewCspHeader().split('; ');

    expect(directives).toContain("script-src 'unsafe-inline'");
    expect(directives).toContain("style-src 'unsafe-inline' https:");
    expect(directives).toContain("style-src-attr 'unsafe-inline'");
  });

  it('restricts embedding to this app only by default, and blocks plugin content', () => {
    const directives = createHtmlPreviewCspHeader().split('; ');

    expect(directives).toContain("frame-ancestors 'self'");
    expect(directives).toContain("object-src 'none'");
  });

  it('includes configured iframe-embed origins in frame-ancestors, alongside self', () => {
    const directives = createHtmlPreviewCspHeader([
      'https://overlay.example.com',
    ]).split('; ');

    expect(directives).toContain(
      "frame-ancestors 'self' https://overlay.example.com",
    );
  });

  it('narrows default-src to self/data/blob, without a bare https: fallback', () => {
    const directives = createHtmlPreviewCspHeader().split('; ');

    expect(directives).toContain("default-src 'self' data: blob:");
  });

  it('does not permit eval or outbound network access from the previewed document', () => {
    const header = createHtmlPreviewCspHeader();
    const directives = header.split('; ');

    expect(header).not.toContain("'unsafe-eval'");
    expect(directives).toContain("connect-src 'none'");
  });

  it('sandboxes the previewed document at an opaque origin', () => {
    const directives = createHtmlPreviewCspHeader().split('; ');

    expect(directives).toContain('sandbox allow-scripts');
  });

  it('blocks base-tag rewriting, form submission, and worker creation', () => {
    const directives = createHtmlPreviewCspHeader().split('; ');

    expect(directives).toContain("base-uri 'none'");
    expect(directives).toContain("form-action 'none'");
    expect(directives).toContain("worker-src 'none'");
  });

  it('blocks the previewed document from framing further content', () => {
    const directives = createHtmlPreviewCspHeader().split('; ');

    expect(directives).toContain("frame-src 'none'");
    expect(directives).toContain("child-src 'none'");
  });

  it('returns the same header value on every call', () => {
    expect(createHtmlPreviewCspHeader()).toBe(createHtmlPreviewCspHeader());
  });
});

describe('buildDownloadFrameAncestorsDirective', () => {
  it('always includes self, even with no configured origins', () => {
    expect(buildDownloadFrameAncestorsDirective([])).toEqual(["'self'"]);
  });

  it('appends configured origins after self', () => {
    expect(
      buildDownloadFrameAncestorsDirective(['https://overlay.example.com']),
    ).toEqual(["'self'", 'https://overlay.example.com']);
  });
});

describe('extractOrigin', () => {
  it('returns the origin of an absolute URL, dropping path and query', () => {
    expect(extractOrigin('https://viz.example.com/app?x=1')).toBe(
      'https://viz.example.com',
    );
  });

  it('keeps an explicit non-default port', () => {
    expect(extractOrigin('http://localhost:4207/app')).toBe(
      'http://localhost:4207',
    );
  });

  it('returns undefined for an unparseable value', () => {
    expect(extractOrigin('not-a-url')).toBeUndefined();
  });
});

describe('isOriginAllowedForIframe', () => {
  it('matches an exact origin entry', () => {
    expect(
      isOriginAllowedForIframe('https://viz.example.com/app', [
        'https://viz.example.com',
      ]),
    ).toBe(true);
  });

  it('does not match a different scheme, host, or port', () => {
    const url = 'https://viz.example.com/app';
    expect(isOriginAllowedForIframe(url, ['http://viz.example.com'])).toBe(
      false,
    );
    expect(isOriginAllowedForIframe(url, ['https://other.example.com'])).toBe(
      false,
    );
    expect(
      isOriginAllowedForIframe(url, ['https://viz.example.com:8443']),
    ).toBe(false);
  });

  it('matches a subdomain through a leading-wildcard-label entry', () => {
    expect(
      isOriginAllowedForIframe('https://viz.example.com', [
        'https://*.example.com',
      ]),
    ).toBe(true);
  });

  it('does not match the apex through a wildcard entry, as CSP does not', () => {
    expect(
      isOriginAllowedForIframe('https://example.com', [
        'https://*.example.com',
      ]),
    ).toBe(false);
  });

  it('does not match a wildcard entry across schemes or ports', () => {
    expect(
      isOriginAllowedForIframe('http://viz.example.com', [
        'https://*.example.com',
      ]),
    ).toBe(false);
    expect(
      isOriginAllowedForIframe('https://viz.example.com:8443', [
        'https://*.example.com',
      ]),
    ).toBe(false);
  });

  it('returns false for an empty allowlist, blank entries, and an unparseable URL', () => {
    expect(isOriginAllowedForIframe('https://viz.example.com', [])).toBe(false);
    expect(isOriginAllowedForIframe('https://viz.example.com', ['  '])).toBe(
      false,
    );
    expect(
      isOriginAllowedForIframe('not-a-url', ['https://viz.example.com']),
    ).toBe(false);
  });

  it('tolerates surrounding whitespace on an allowlist entry', () => {
    expect(
      isOriginAllowedForIframe('https://viz.example.com', [
        ' https://viz.example.com ',
      ]),
    ).toBe(true);
  });
});
