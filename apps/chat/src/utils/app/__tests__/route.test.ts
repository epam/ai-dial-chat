import { describe, expect, it } from 'vitest';

import { Routes } from '@/src/constants/routes';

import { getInternalPathname, isInternalRoute } from '../route';

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
