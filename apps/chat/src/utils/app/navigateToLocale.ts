import { NextRouter } from 'next/router';

const stripLocalePrefix = (pathname: string, localeCodes: string[]): string => {
  const segments = pathname.split('/').filter(Boolean);

  if (segments.length > 0 && localeCodes.includes(segments[0])) {
    const rest = segments.slice(1).join('/');

    return rest ? `/${rest}` : '/';
  }

  return pathname || '/';
};

const buildLocalizedPath = (
  pathname: string,
  locale: string,
  defaultLocale: string,
  basePath: string,
): string => {
  if (locale === defaultLocale) {
    return `${basePath}${pathname}`;
  }

  return `${basePath}/${locale}${pathname === '/' ? '' : pathname}`;
};

export const navigateToLocale = (
  router: NextRouter,
  locale: string,
  availableLocales: string[],
): void => {
  if (!availableLocales.includes(locale)) {
    return;
  }

  const defaultLocale = router.defaultLocale ?? 'en';
  const basePath = router.basePath ?? '';
  const localeCodes = [
    ...new Set([...(router.locales ?? []), ...availableLocales]),
  ];
  const [rawPathname, search = ''] = router.asPath.split('?');
  const pathname = stripLocalePrefix(rawPathname, localeCodes);

  const canUseRouterPush =
    router.locales?.includes(locale) &&
    availableLocales.every((code) => router.locales?.includes(code));

  if (canUseRouterPush) {
    void router.push(
      { pathname: router.pathname, query: router.query },
      search ? `${pathname}?${search}` : pathname,
      { locale },
    );
    return;
  }

  const localizedPath = buildLocalizedPath(
    pathname,
    locale,
    defaultLocale,
    basePath,
  );

  window.location.assign(search ? `${localizedPath}?${search}` : localizedPath);
};
