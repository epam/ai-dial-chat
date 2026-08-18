import {
  AttachmentCanvasBody,
  useAttachmentCanvas,
} from '@epam/ai-dial-attachment-canvas';
import { CodeBlockTheme } from '@epam/ai-dial-chat-shared';
import type { FC } from 'react';
import { useTranslation } from 'react-i18next';
import { AttachmentCanvasI18nKeys } from '../../constants/translation-keys';
import { useTheme } from '../../context/ThemeContext';
import { ThemeId } from '../../types/theme-id';

/** Props for {@link SkillFilePreview}. */
interface Props {
  /**
   * Full relative path of the currently selected supporting file. Used to
   * guard against briefly rendering another file's content — the global
   * attachment canvas can momentarily hold a slower-resolving earlier
   * selection's content after a newer selection has already committed.
   */
  path: string;
}

/**
 * Renders a Skill supporting file's content inline in the Skill Editor's main
 * pane, reusing the same `AttachmentCanvasBody` renderers chat attachments use
 * (Markdown/JSON/code/HTML/PDF/image/audio/unsupported/error). Content only —
 * no header: `libs/skill-editor`'s own main-pane heading already shows the
 * selected file's name, and per the Figma design there is no dedicated
 * download/close control in this surface — re-selecting `SKILL.md` in the
 * file tree already returns to the manifest form.
 */
export const SkillFilePreview: FC<Props> = ({ path }) => {
  const { t } = useTranslation();
  const { currentTheme } = useTheme();
  const { isLoading, content, fileName, attachmentId } = useAttachmentCanvas();

  const isCurrent = attachmentId === path;

  return (
    <div
      role="group"
      aria-label={fileName ?? t(AttachmentCanvasI18nKeys.AriaLabel)}
      className="h-full min-h-0 min-w-0 overflow-hidden"
    >
      <AttachmentCanvasBody
        content={content}
        isLoading={!isCurrent || isLoading}
        fileName={fileName}
        labels={{
          unsupportedLabel: t(AttachmentCanvasI18nKeys.UnsupportedLabel),
          loadErrorLabel: t(AttachmentCanvasI18nKeys.LoadErrorLabel),
          forbiddenErrorLabel: t(AttachmentCanvasI18nKeys.ForbiddenErrorLabel),
          htmlFrameBlockedLabel: t(AttachmentCanvasI18nKeys.HtmlFrameBlocked),
          htmlOpenInNewTabLabel: t(AttachmentCanvasI18nKeys.HtmlOpenInNewTab),
          pdfThumbnailsLabel: t(AttachmentCanvasI18nKeys.PdfThumbnailsLabel),
          pdfShowThumbnailsLabel: t(
            AttachmentCanvasI18nKeys.PdfShowThumbnailsLabel,
          ),
          pdfHideThumbnailsLabel: t(
            AttachmentCanvasI18nKeys.PdfHideThumbnailsLabel,
          ),
          pdfPageNumberLabel: t(AttachmentCanvasI18nKeys.PdfPageNumberLabel),
        }}
        codeBlockTheme={
          currentTheme === ThemeId.Dark
            ? CodeBlockTheme.Dark
            : CodeBlockTheme.Light
        }
        hidePdfToolbar
      />
    </div>
  );
};
