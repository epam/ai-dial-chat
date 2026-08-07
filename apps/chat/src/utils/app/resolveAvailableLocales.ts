import { parseCommaSeparatedList } from '@/src/utils/app/common';

import { DEFAULT_LOCAL } from '@/src/constants/locale';

import fs from 'fs';
import path from 'path';

const getLocaleCodesFromPublicDir = (): string[] | null => {
  const localesPath = path.resolve(process.cwd(), 'public/locales');

  if (!fs.existsSync(localesPath)) {
    return null;
  }

  return fs
    .readdirSync(localesPath)
    .filter((dir) => fs.statSync(path.join(localesPath, dir)).isDirectory());
};

const normalizeLocales = (locales: string[]): string[] => {
  const unique = [...new Set(locales)];

  return unique.includes(DEFAULT_LOCAL) ? unique : [DEFAULT_LOCAL, ...unique];
};

/**
 * Resolves locale codes from runtime env or mounted public/locales directories.
 * Used server-side in getCommonPageProps (same pattern as ENABLED_FEATURES).
 */
export const resolveAvailableLocales = (): string[] => {
  const fromEnv = process.env.AVAILABLE_LOCALES
    ? parseCommaSeparatedList(
        process.env.AVAILABLE_LOCALES.replace(/[\]['"]/g, ''),
      )
    : null;
  const fromPublicDir = getLocaleCodesFromPublicDir();
  const result =
    fromEnv ?? (fromPublicDir?.length ? fromPublicDir : [DEFAULT_LOCAL]);

  return normalizeLocales(result);
};
