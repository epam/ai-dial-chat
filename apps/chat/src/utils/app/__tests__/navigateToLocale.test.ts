import { beforeEach, describe, expect, it, vi } from 'vitest';

import { NextRouter } from 'next/router';

import { navigateToLocale } from '@/src/utils/app/navigateToLocale';

describe('navigateToLocale', () => {
  const push = vi.fn();
  const assign = vi.fn();

  beforeEach(() => {
    push.mockReset();
    assign.mockReset();
    vi.stubGlobal('window', { location: { assign } });
  });

  const createRouter = (overrides: Partial<NextRouter> = {}): NextRouter =>
    ({
      locales: ['en'],
      defaultLocale: 'en',
      basePath: '',
      pathname: '/',
      query: {},
      asPath: '/',
      push,
      ...overrides,
    }) as NextRouter;

  it('uses router.push when locale is in router.locales', () => {
    const router = createRouter({ locales: ['en', 'ar'], asPath: '/chat' });

    navigateToLocale(router, 'ar', ['en', 'ar']);

    expect(push).toHaveBeenCalledWith({ pathname: '/', query: {} }, '/chat', {
      locale: 'ar',
    });
    expect(assign).not.toHaveBeenCalled();
  });

  it('uses full-page navigation when locale is not in router.locales', () => {
    const router = createRouter({ asPath: '/chat?foo=bar' });

    navigateToLocale(router, 'ar', ['en', 'ar']);

    expect(push).not.toHaveBeenCalled();
    expect(assign).toHaveBeenCalledWith('/ar/chat?foo=bar');
  });

  it('does nothing when locale is not in availableLocales', () => {
    const router = createRouter();

    navigateToLocale(router, 'ar', ['en']);

    expect(push).not.toHaveBeenCalled();
    expect(assign).not.toHaveBeenCalled();
  });
});
