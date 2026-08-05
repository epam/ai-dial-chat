import DOMPurify from 'dompurify';
import { FOOTER_HTML_SANITIZE_OPTIONS } from '../constants/footer-message';

export const sanitizeFooterHtml = (html: string): string =>
  DOMPurify.sanitize(html, FOOTER_HTML_SANITIZE_OPTIONS) as string;
