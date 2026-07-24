import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { getFrameContentSecurityPolicyDirectives } from '../headers-helpers';

describe('getFrameContentSecurityPolicyDirectives', () => {
  const originalValue = process.env.ALLOWED_IMAGE_SOURCES;

  beforeEach(() => {
    delete process.env.ALLOWED_IMAGE_SOURCES;
  });

  afterEach(() => {
    if (originalValue === undefined) {
      delete process.env.ALLOWED_IMAGE_SOURCES;
    } else {
      process.env.ALLOWED_IMAGE_SOURCES = originalValue;
    }
  });

  const getImgSrc = (csp: string) =>
    csp
      .split(';')
      .map((directive) => directive.trim())
      .find((directive) => directive.startsWith('img-src'));

  it('includes the product image defaults in img-src when unconfigured', () => {
    const [csp] = getFrameContentSecurityPolicyDirectives();
    const imgSrc = getImgSrc(csp);

    expect(imgSrc).toContain("'self'");
    expect(imgSrc).toContain('data:');
    expect(imgSrc).toContain('blob:');
    expect(imgSrc).toContain('https://authjs.dev/img/providers/');
    expect(imgSrc).toContain('https://s.gravatar.com/');
    expect(imgSrc).toContain('https://i1.wp.com/cdn.auth0.com/avatars/');
    expect(imgSrc).toContain('https://cdn.auth0.com/avatars/');
  });

  it('keeps the admin-configured origins alongside the defaults', () => {
    process.env.ALLOWED_IMAGE_SOURCES = 'https://cdn.mycorp.com';
    const [csp] = getFrameContentSecurityPolicyDirectives();
    const imgSrc = getImgSrc(csp);

    expect(imgSrc).toContain('https://cdn.mycorp.com');
    expect(imgSrc).toContain('https://authjs.dev/img/providers/');
  });
});
