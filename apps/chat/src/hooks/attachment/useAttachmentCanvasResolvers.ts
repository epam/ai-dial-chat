import type {
  UseOpenAttachmentCanvasOptions,
  UseOpenAttachmentCanvasResolvers,
} from '@epam/ai-dial-attachment-canvas';
import {
  hasAttachmentTextSource,
  referenceAttachmentToPdfCanvasContent,
  resolveCodeCanvasContent,
  resolveHtmlCanvasContent,
  resolveImageCanvasContent,
  resolveJsonCanvasContent,
  resolveMarkdownCanvasContent,
  resolveOoxmlCanvasContent,
  resolvePdfCanvasContent,
  resolveTextCanvasContent,
  resolveVisualizerCanvasContent,
} from '@epam/ai-dial-chat-hooks';
import { useCallback, useMemo } from 'react';
import { useConversationPanel } from '../../context/ConversationPanelContext';
import { useSourcesSidebar } from '../../context/SourcesSidebarContext';
import { useTheme } from '../../context/ThemeContext';
import { attachmentCanvasUrlResolvers } from '../../utils/attachment-display-resolvers';
import { resolveDialUrl } from '../../utils/dial-file';
import { useCustomVisualizers } from './useCustomVisualizers';

/*
 * Every resolver wraps the shared content resolver with the app's injected
 * DIAL-URL resolution (`attachmentCanvasUrlResolvers`); none of it depends on
 * per-render state, so the object is built once at module scope.
 */
const resolvers: UseOpenAttachmentCanvasResolvers = {
  resolveImageContent: (attachment) =>
    resolveImageCanvasContent(attachment, attachmentCanvasUrlResolvers),
  resolveTextContent: (attachment) =>
    resolveTextCanvasContent(attachment, attachmentCanvasUrlResolvers),
  resolveMarkdownContent: (attachment) =>
    resolveMarkdownCanvasContent(attachment, attachmentCanvasUrlResolvers),
  resolveCodeContent: (attachment, language) =>
    resolveCodeCanvasContent(
      attachment,
      attachmentCanvasUrlResolvers,
      language,
    ),
  resolveHtmlContent: (attachment) =>
    resolveHtmlCanvasContent(attachment, attachmentCanvasUrlResolvers),
  resolvePdfContent: (attachment) =>
    resolvePdfCanvasContent(attachment, attachmentCanvasUrlResolvers),
  resolveOoxmlContent: (attachment, format) =>
    resolveOoxmlCanvasContent(attachment, attachmentCanvasUrlResolvers, format),
  resolveJsonContent: (attachment) =>
    resolveJsonCanvasContent(attachment, attachmentCanvasUrlResolvers),
  /* The app resolver's `themeId` is required; the lib's contract allows it to
   * be omitted, so a missing theme falls back to an empty string. */
  resolveVisualizerContent: (attachment, visualizer, themeId) =>
    resolveVisualizerCanvasContent(
      attachment,
      attachmentCanvasUrlResolvers,
      visualizer,
      themeId ?? '',
    ),
  /* `referenceAttachmentToPdfCanvasContent` takes an `AttachmentResource`
   * (type/url/title), not a `DisplayAttachment` — the hook only calls this
   * resolver when `attachment.referenceUrl` is set, so the reference URL
   * (not `attachment.url`, which is null in that branch) is what gets
   * checked for a PDF page reference. */
  resolveReferencePdfContent: (attachment) =>
    referenceAttachmentToPdfCanvasContent(
      {
        type: attachment.contentType,
        url: attachment.referenceUrl ?? '',
        title: attachment.name,
      },
      attachmentCanvasUrlResolvers,
    ),
  resolveContentUrl: resolveDialUrl,
  hasTextSource: (attachment) =>
    hasAttachmentTextSource(attachment, attachmentCanvasUrlResolvers),
};

/**
 * Bundles the resolver and options parameters
 * `@epam/ai-dial-attachment-canvas`'s `useOpenAttachmentCanvas` needs, wiring
 * the app's content resolvers, the custom-visualizer registry, the active
 * theme, and the panel-coordination callback so every call site supplies the
 * exact same seam.
 */
export const useAttachmentCanvasResolvers = (): {
  resolvers: UseOpenAttachmentCanvasResolvers;
  options: UseOpenAttachmentCanvasOptions;
} => {
  const { closePanel } = useConversationPanel();
  const { handleClose: closeSourcesPanel } = useSourcesSidebar();
  const customVisualizers = useCustomVisualizers();
  const { currentTheme: themeId } = useTheme();

  const onBeforeOpen = useCallback(() => {
    closePanel();
    closeSourcesPanel();
  }, [closePanel, closeSourcesPanel]);

  return useMemo(
    () => ({
      resolvers,
      options: { customVisualizers, themeId, onBeforeOpen },
    }),
    [customVisualizers, themeId, onBeforeOpen],
  );
};
