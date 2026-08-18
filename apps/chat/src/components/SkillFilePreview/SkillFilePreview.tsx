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

/** Props for the inline skill supporting-file preview. */
interface Props {
  /** Opaque path identifying the file currently selected by the host. */
  path: string;
}

/**
 * Renders a skill supporting file through the same attachment-canvas body
 * used by chat attachments. The host owns the surrounding file heading and
 * selection controls, so this component renders content only.
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
