import DOMPurify from 'dompurify';
import { FOOTER_HTML_SANITIZE_OPTIONS } from '../constants/footer-message';

export const sanitizeFooterHtml = (html: string): string =>
  DOMPurify.sanitize(html, FOOTER_HTML_SANITIZE_OPTIONS) as string;

export const findDialAction = (target: EventTarget | null): string | null => {
  if (!(target instanceof Element)) return null;
  const el = target.closest('[data-dial-action]');
  return el instanceof HTMLElement ? (el.dataset.dialAction ?? null) : null;
};
