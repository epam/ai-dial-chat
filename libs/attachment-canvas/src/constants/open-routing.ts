import { FileExtension, MIMEType } from '@epam/ai-dial-chat-shared';
import { OpenResolverName } from '../types/open-resolver';

/** Resolver per MIME type; a match whose resolver returns nothing falls back to Unsupported content. */
export const MIME_TYPE_RESOLVERS: Partial<Record<string, OpenResolverName>> = {
  [MIMEType.PDF]: OpenResolverName.Pdf,
  [MIMEType.Markdown]: OpenResolverName.Markdown,
  [MIMEType.JSON]: OpenResolverName.Json,
};

/** Resolver per file extension; a match whose resolver returns nothing leaves the canvas closed. */
export const EXTENSION_RESOLVERS: Partial<Record<string, OpenResolverName>> = {
  [FileExtension.Markdown]: OpenResolverName.Markdown,
  [FileExtension.MarkdownAlt]: OpenResolverName.Markdown,
  [FileExtension.JSON]: OpenResolverName.Json,
  [FileExtension.PDF]: OpenResolverName.Pdf,
};
