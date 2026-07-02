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

  it('uses router.push when all available locales are in router.locales', () => {
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

  it('uses full-page navigation when runtime locales are not fully baked', () => {
    const router = createRouter({
      locale: 'ar',
      asPath: '/ar',
    });

    navigateToLocale(router, 'en', ['en', 'ar']);

    expect(push).not.toHaveBeenCalled();
    expect(assign).toHaveBeenCalledWith('/');
  });

  it('strips locale prefix from polluted asPath before navigating to default locale', () => {
    const router = createRouter({
      locale: 'ar',
      asPath: '/ar/marketplace?tab=1',
    });

    navigateToLocale(router, 'en', ['en', 'ar']);

    expect(assign).toHaveBeenCalledWith('/marketplace?tab=1');
  });

  it('navigates to runtime-only locale via full-page navigation', () => {
    const router = createRouter({ asPath: '/' });

    navigateToLocale(router, 'ar', ['en', 'ar']);

    expect(push).not.toHaveBeenCalled();
    expect(assign).toHaveBeenCalledWith('/ar');
  });

  it('does nothing when locale is not in availableLocales', () => {
    const router = createRouter();

    navigateToLocale(router, 'ar', ['en']);

    expect(push).not.toHaveBeenCalled();
    expect(assign).not.toHaveBeenCalled();
  });
});
