import type { Annotation } from '@epam/ai-dial-chat-shared';
import { MIMEType } from '@epam/ai-dial-chat-shared';

/**
 * Whether an annotation's source is a web page rather than a file. A web
 * page keeps the citation card (quote + "Open in browser"), while a file can
 * be previewed straight from its marker; the card's "Open in browser" vs
 * "Download" label uses the same rule so the two never disagree.
 */
export const isWebLinkAnnotation = (annotation: Annotation): boolean => {
  const type = annotation.body?.source?.attachment?.type;
  return type === MIMEType.HTML || type === MIMEType.XHTML;
};
