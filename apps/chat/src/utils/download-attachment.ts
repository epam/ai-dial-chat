import { resolveDialFileUrl } from './icon-path';

const isAbsoluteUrl = (url: string): boolean =>
  url.startsWith('http://') ||
  url.startsWith('https://') ||
  url.startsWith('//');

const getDownloadUrl = (url: string): string | undefined => {
  if (url.startsWith('files/')) return resolveDialFileUrl(url);
  if (isAbsoluteUrl(url)) return url;
  return undefined;
};

export const downloadAttachment = (url: string, filename: string): void => {
  const downloadUrl = getDownloadUrl(url);
  if (!downloadUrl) return;
  const a = document.createElement('a');
  a.href = downloadUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
};
