import type { ReactElement, ReactNode } from 'react';

import { Inconsolata, Inter } from 'next/font/google';

import { SettingsState } from '@/src/store/settings/settings.types';

import { Layout } from '@/src/components/Layout';

export const inter = Inter({
  subsets: ['latin'],
  weight: 'variable',
  variable: '--font-inter',
});

export const inconsolata = Inconsolata({
  subsets: ['latin'],
  weight: 'variable',
  variable: '--font-inconsolata',
});

export function getLayout(
  page: ReactElement,
  settings: SettingsState,
): ReactNode {
  return <Layout settings={settings}>{page}</Layout>;
}
