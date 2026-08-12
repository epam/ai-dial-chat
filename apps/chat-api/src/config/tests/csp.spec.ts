import { Controller, Get, INestApplication, Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import {
  buildFrameAncestorsDirective,
  buildFrameSrcDirective,
  createHelmetOptions,
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
): Promise<INestApplication> => {
  @Module({ controllers: [PingController] })
  class CspTestModule {}

  const app = await NestFactory.create(CspTestModule, { logger: false });
  app.use(helmet(createHelmetOptions(allowedIframeOrigins)));
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
});
