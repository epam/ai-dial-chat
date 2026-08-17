import { describe, expect, it } from 'vitest';

import { Routes } from '@/src/constants/routes';

import {
  getInternalPathname,
  getInternalRoute,
  isInternalRoute,
} from '../route';

const router = { basePath: '', locales: ['en', 'ru', 'de'] };
const routerWithBasePath = { basePath: '/chat', locales: ['en', 'ru', 'de'] };

describe('getInternalPathname', () => {
  it('returns pathname as is for the default locale', () => {
    expect(getInternalPathname('/marketplace', router)).toBe('/marketplace');
    expect(getInternalPathname('/apps-editor', router)).toBe('/apps-editor');
  });

  it('strips a non-default locale prefix', () => {
    expect(getInternalPathname('/ru/marketplace', router)).toBe('/marketplace');
    expect(getInternalPathname('/de/apps-editor', router)).toBe('/apps-editor');
    expect(getInternalPathname('/ru/auth/toolset-signin', router)).toBe(
      '/auth/toolset-signin',
    );
  });

  it('strips the basePath', () => {
    expect(getInternalPathname('/chat/marketplace', routerWithBasePath)).toBe(
      '/marketplace',
    );
  });

  it('strips both basePath and locale', () => {
    expect(
      getInternalPathname('/chat/ru/marketplace', routerWithBasePath),
    ).toBe('/marketplace');
  });

  it('returns root for locale-only pathnames', () => {
    expect(getInternalPathname('/ru', router)).toBe('/');
    expect(getInternalPathname('/chat', routerWithBasePath)).toBe('/');
    expect(getInternalPathname('/', router)).toBe('/');
  });

  it('does not strip segments that are not known locales', () => {
    expect(getInternalPathname('/marketplace/ru', router)).toBe(
      '/marketplace/ru',
    );
    expect(getInternalPathname('/fr/marketplace', router)).toBe(
      '/fr/marketplace',
    );
  });

  it('works without router info', () => {
    expect(getInternalPathname('/marketplace')).toBe('/marketplace');
  });
});

describe('isInternalRoute', () => {
  it('matches routes regardless of the active locale', () => {
    expect(isInternalRoute('/marketplace', Routes.Marketplace, router)).toBe(
      true,
    );
    expect(isInternalRoute('/ru/marketplace', Routes.Marketplace, router)).toBe(
      true,
    );
    expect(
      isInternalRoute('/chat/ru/apps-editor', Routes.AppsEditor, {
        basePath: '/chat',
        locales: ['en', 'ru'],
      }),
    ).toBe(true);
  });

  it('does not match unrelated routes', () => {
    expect(isInternalRoute('/ru/apps-editor', Routes.Marketplace, router)).toBe(
      false,
    );
  });
});

describe('getInternalRoute', () => {
  const origin = 'https://example.com';

  it('strips the locale prefix so the current locale can be applied', () => {
    expect(
      getInternalRoute(
        new URL('/ru/marketplace?tab=MY_WORKSPACE', origin),
        router,
      ),
    ).toEqual({
      pathname: Routes.Marketplace,
      query: { tab: 'MY_WORKSPACE' },
    });
  });

  it('strips the basePath together with the locale', () => {
    expect(
      getInternalRoute(
        new URL('/chat/ru/marketplace', origin),
        routerWithBasePath,
      ),
    ).toEqual({ pathname: Routes.Marketplace, query: {} });
  });

  it('keeps default-locale urls untouched', () => {
    expect(getInternalRoute(new URL('/marketplace', origin), router)).toEqual({
      pathname: Routes.Marketplace,
      query: {},
    });
  });

  it('decodes and preserves all query params', () => {
    expect(
      getInternalRoute(
        new URL('/de/apps-editor?id=my%2Fapp&step=general', origin),
        router,
      ),
    ).toEqual({
      pathname: Routes.AppsEditor,
      query: { id: 'my/app', step: 'general' },
    });
  });
});
