import { i18n } from 'next-i18next';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const translate = (text: string, options?: any) =>
  i18n ? (i18n.t(text, options) as unknown as string) : text;
