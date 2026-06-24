import { parseCommaSeparatedList } from '@/src/utils/app/common';

import fs from 'fs';
import path from 'path';

const DEFAULT_LOCALE = 'en';

const scanLocaleDirs = (): string[] | null => {
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

  return unique.includes(DEFAULT_LOCALE) ? unique : [DEFAULT_LOCALE, ...unique];
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
  const scanned = scanLocaleDirs();
  const result = fromEnv ?? (scanned?.length ? scanned : [DEFAULT_LOCALE]);

  return normalizeLocales(result);
};
