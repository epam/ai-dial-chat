import { NextRouter } from 'next/router';

export const navigateToLocale = (
  router: NextRouter,
  locale: string,
  availableLocales: string[],
): void => {
  if (!availableLocales.includes(locale)) {
    return;
  }

  if (router.locales?.includes(locale)) {
    void router.push(
      { pathname: router.pathname, query: router.query },
      router.asPath,
      { locale },
    );
    return;
  }

  const defaultLocale = router.defaultLocale ?? 'en';
  const basePath = router.basePath ?? '';
  const [pathname, search = ''] = router.asPath.split('?');
  const localizedPath =
    locale === defaultLocale
      ? `${basePath}${pathname}`
      : `${basePath}/${locale}${pathname === '/' ? '' : pathname}`;

  window.location.assign(search ? `${localizedPath}?${search}` : localizedPath);
};
