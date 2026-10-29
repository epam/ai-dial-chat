import {
  AttachmentCanvasBody,
  useAttachmentCanvas,
} from '@epam/ai-dial-attachment-canvas';
import { CodeBlockTheme, mergeClasses } from '@epam/ai-dial-chat-shared';
import {
  ErrorText,
  NeutralButton,
  LiveRegionPoliteness,
} from '@epam/ai-dial-ui-kit';
import type { FC } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AttachmentCanvasI18nKeys,
  ButtonsI18nKeys,
  ChatI18nKeys,
  AttachmentsI18nKeys,
} from '../../constants/translation-keys';
import { useTheme } from '../../context/ThemeContext';
import { usePdfPreviewLoader } from '../../hooks/attachment/usePdfPreviewLoader';
import { SkillFilePreviewState } from '../../types/skill-file-preview';
import { ThemeId } from '../../types/theme-id';
import { configurePdfWorker } from '../../utils/pdf';

/** Props for the inline skill supporting-file preview. */
interface Props {
  /**
   * Presentation state for the currently selected file, owned by
   * `useSkillFilePreviewSync` rather than inferred from the canvas's
   * selection.
   */
  state: SkillFilePreviewState;
  /**
   * Re-attempts the failed open for the current selection. Omitted by hosts
   * that surface their own failures as canvas content instead.
   */
  onRetry?: () => void;
}

/**
 * Renders a skill supporting file through the same attachment-canvas body
 * used by chat attachments. The host owns the surrounding file heading and
 * selection controls, so this component renders content only.
 */
export const SkillFilePreview: FC<Props> = ({ state, onRetry }) => {
  const { t } = useTranslation();
  const loadPdf = usePdfPreviewLoader();
  const { currentTheme } = useTheme();
  const { content, fileName } = useAttachmentCanvas();
  const isError = state === SkillFilePreviewState.Error;

  return (
    /* Outside the error state this wrapper has no box of its own, so the
     * canvas group lays out as a direct child of the host. */
    <div
      className={mergeClasses(
        isError
          ? 'flex h-full min-h-0 min-w-0 flex-col items-center justify-center gap-3'
          : 'contents',
      )}
    >
      {/* A failed load with a retry is not a field error: announce it. */}
      <ErrorText
        announce={LiveRegionPoliteness.Assertive}
        text={isError ? t(AttachmentCanvasI18nKeys.LoadErrorLabel) : ''}
      />
      {isError && onRetry != null && (
        <NeutralButton label={t(ButtonsI18nKeys.Retry)} onClick={onRetry} />
      )}
      {!isError && (
        <div
          role="group"
          aria-label={fileName ?? t(AttachmentCanvasI18nKeys.AriaLabel)}
          className="h-full min-h-0 min-w-0 overflow-hidden"
        >
          <AttachmentCanvasBody
            content={content}
            isLoading={state === SkillFilePreviewState.Loading}
            fileName={fileName}
            labels={{
              unsupportedLabel: t(AttachmentCanvasI18nKeys.UnsupportedLabel),
              loadErrorLabel: t(AttachmentCanvasI18nKeys.LoadErrorLabel),
              forbiddenErrorLabel: t(
                AttachmentCanvasI18nKeys.ForbiddenErrorLabel,
              ),
              htmlFrameBlockedLabel: t(
                AttachmentCanvasI18nKeys.HtmlFrameBlocked,
              ),
              htmlOpenInNewTabLabel: t(AttachmentsI18nKeys.OpenInNewTab),
              pdfThumbnailsLabel: t(
                AttachmentCanvasI18nKeys.PdfThumbnailsLabel,
              ),
              pdfShowThumbnailsLabel: t(
                AttachmentCanvasI18nKeys.PdfShowThumbnailsLabel,
              ),
              pdfHideThumbnailsLabel: t(
                AttachmentCanvasI18nKeys.PdfHideThumbnailsLabel,
              ),
              pdfPageNumberLabel: t(
                AttachmentCanvasI18nKeys.PdfPageNumberLabel,
              ),
              xlsxFormulaLabel: t(AttachmentCanvasI18nKeys.XlsxFormulaLabel),
              codeBlockCopyLabel: t(ButtonsI18nKeys.Copy),
              codeBlockCopiedLabel: t(ButtonsI18nKeys.Copied),
              codeBlockDownloadLabel: t(ButtonsI18nKeys.Download),
              tableScrollRegionAriaLabel: t(ChatI18nKeys.ScrollableTable),
              mathScrollRegionAriaLabel: t(ChatI18nKeys.ScrollableFormula),
            }}
            codeBlockTheme={
              currentTheme === ThemeId.Dark
                ? CodeBlockTheme.Dark
                : CodeBlockTheme.Light
            }
            configurePdfWorker={configurePdfWorker}
            loadPdf={loadPdf}
            hidePdfToolbar
          />
        </div>
      )}
    </div>
  );
};
