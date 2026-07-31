import type { Annotation } from '@epam/ai-dial-chat-shared';
import {
  MarkdownRenderer,
  mergeClasses,
  MIMEType,
} from '@epam/ai-dial-chat-shared';
import {
  DialEllipsisTooltip,
  GhostIconButton,
  ElementSize,
  PrimaryButton,
} from '@epam/ai-dial-ui-kit';
import { IconChevronLeft, IconChevronRight } from '@tabler/icons-react';
import { FC, memo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  BasicI18nKeys,
  ButtonsI18nKeys,
  CitationsI18nKeys,
} from '../../../constants/translation-keys';
import type { AnnotationGroup } from '../../../utils/group-annotations-by-source';
import FileTypeIcon from '../../FileTypeIcon/FileTypeIcon';

interface Props {
  /** The annotation group whose citations are displayed in this popup. */
  group: AnnotationGroup;
  /** Zero-based index into `group.annotations` for the currently shown citation. */
  activeIndex: number;
  /** Called when the user navigates to a different annotation within the group. */
  onIndexChange: (index: number) => void;
  /**
   * Called when the user clicks the "Preview" button. Omit when the group has
   * nothing previewable (e.g. reference-only chunks) — the "Preview" button is
   * hidden and the remaining button is always labelled "Open in browser".
   */
  onPreview?: (annotation: Annotation) => void;
  /** Called when the user clicks the "Open in browser"/"Download" button. */
  onOpenInBrowser: (annotation: Annotation) => void;
}

const CitationCard: FC<Props> = ({
  group,
  activeIndex,
  onIndexChange,
  onPreview,
  onOpenInBrowser,
}) => {
  const { t } = useTranslation();
  const total = group.annotations.length;
  const annotation = group.annotations[activeIndex] ?? group.primaryAnnotation;
  const hasSwitcher = total > 1;
  const groupHasTitle = group.annotations.some((a) => a.body?.title);
  const sourceContentType =
    group.primaryAnnotation.body?.source?.attachment?.type;
  const isWebLink =
    onPreview == null ||
    sourceContentType === MIMEType.HTML ||
    sourceContentType === MIMEType.XHTML;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t(CitationsI18nKeys.MarkerAriaLabel, {
        source: group.sourceName,
      })}
      className="flex w-[400px] flex-col gap-3 rounded-lg border border-primary bg-layer-0 p-4 shadow-lg"
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1">
          {sourceContentType && (
            <FileTypeIcon
              contentType={sourceContentType}
              size={18}
              className="text-secondary"
            />
          )}
          <DialEllipsisTooltip
            text={group.sourceName}
            className="dial-tiny-text min-w-0 text-primary"
          />
        </div>
        {hasSwitcher && (
          <div className="flex shrink-0 items-center gap-1">
            <GhostIconButton
              icon={<IconChevronLeft size={14} className="rtl:scale-x-[-1]" />}
              size={ElementSize.Small}
              aria-label={t(CitationsI18nKeys.PopupPreviousCitation)}
              onClick={() => onIndexChange((activeIndex - 1 + total) % total)}
            />
            <span className="dial-tiny-text text-secondary">
              {t(CitationsI18nKeys.PopupSwitcher, {
                current: activeIndex + 1,
                total,
              })}
            </span>
            <GhostIconButton
              icon={<IconChevronRight size={14} className="rtl:scale-x-[-1]" />}
              size={ElementSize.Small}
              aria-label={t(CitationsI18nKeys.PopupNextCitation)}
              onClick={() => onIndexChange((activeIndex + 1) % total)}
            />
          </div>
        )}
      </div>

      {(annotation.body?.title || annotation.body?.quote || hasSwitcher) && (
        <div className="flex flex-col gap-3">
          {(annotation.body?.title || (hasSwitcher && groupHasTitle)) && (
            <p
              className={mergeClasses(
                'dial-body-semi-text text-primary',
                hasSwitcher && groupHasTitle && 'min-h-[1lh]',
              )}
            >
              {annotation.body?.title}
            </p>
          )}
          {(annotation.body?.quote || hasSwitcher) && (
            <div className={mergeClasses(hasSwitcher && 'min-h-[3lh]')}>
              {annotation.body?.quote && (
                <MarkdownRenderer
                  content={annotation.body.quote}
                  classNames={{
                    p: 'dial-small-text line-clamp-6 text-secondary',
                  }}
                />
              )}
            </div>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="flex justify-start gap-2">
        {onPreview && (
          <PrimaryButton
            label={t(BasicI18nKeys.Preview)}
            size={ElementSize.Small}
            onClick={() => onPreview(annotation)}
          />
        )}
        <PrimaryButton
          label={t(
            isWebLink
              ? CitationsI18nKeys.PopupOpenInBrowser
              : ButtonsI18nKeys.Download,
          )}
          size={ElementSize.Small}
          onClick={() => onOpenInBrowser(annotation)}
        />
      </div>
    </div>
  );
};

export default memo(CitationCard);
