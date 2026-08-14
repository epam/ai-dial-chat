import type { Annotation } from '@epam/ai-dial-chat-shared';
import {
  buildCssVars,
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
import { FC, memo, ReactNode } from 'react';
import type { AnnotationGroup } from '../../utils/group-annotations-by-source';
import styles from './CitationCard.module.scss';

/** User-visible strings for `CitationCard`. */
export interface CitationCardLabels {
  /** Dialog aria-label (already includes the source name). */
  ariaLabel: string;
  /** Accessible label for the "previous citation" button. */
  previousCitation: string;
  /** Accessible label for the "next citation" button. */
  nextCitation: string;
  /** Returns the switcher text given the 1-based current index and total count, e.g. `(1, 3) => "1 / 3"`. */
  formatSwitcherText: (current: number, total: number) => string;
  /** Label for the "Preview" button. */
  preview: string;
  /** Label for the "Open in browser" button. */
  openInBrowser: string;
  /** Label for the "Download" button. */
  download: string;
}

/** Color overrides for `CitationCard`, applied as CSS custom properties with app theme fallbacks. */
export interface CitationCardColors {
  /** Card background color. Fallback: `--bg-layer-raised`. */
  cardBackground?: string;
  /** Quoted excerpt text color. Fallback: `--text-secondary`. */
  quoteText?: string;
  /** Annotation title text color. Fallback: `--text-primary`. */
  titleText?: string;
  /** Pagination switcher text color. Fallback: `--text-secondary`. */
  switcherText?: string;
  /** Source name text color. Fallback: `--text-primary`. */
  sourceNameText?: string;
}

/** Typography (font utility class) overrides for `CitationCard`. */
export interface CitationCardTypography {
  /** CSS class applied to the source name ellipsis. Defaults to `'dial-tiny-text'`. */
  sourceNameClassName?: string;
  /** CSS class applied to the annotation title. Defaults to `'dial-body-semi-text'`. */
  titleClassName?: string;
  /** CSS class applied to the quoted excerpt. Defaults to `'dial-small-text'`. */
  quoteClassName?: string;
  /** CSS class applied to the pagination switcher text. Defaults to `'dial-tiny-text'`. */
  switcherClassName?: string;
}

/** Props for the `CitationCard` component. */
export interface CitationCardProps {
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
  /** Optional icon rendered before the source name in the card header. */
  headerIcon?: ReactNode;
  /** User-visible strings. */
  labels: CitationCardLabels;
  /** Optional typography class overrides. */
  typography?: CitationCardTypography;
  /** Optional color overrides. */
  colors?: CitationCardColors;
}

/** Popup card displaying a citation's title, quoted excerpt, and navigation controls. */
export const CitationCard: FC<CitationCardProps> = ({
  group,
  activeIndex,
  onIndexChange,
  onPreview,
  onOpenInBrowser,
  headerIcon,
  labels,
  typography,
  colors,
}) => {
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

  const sourceNameClassName =
    typography?.sourceNameClassName ?? 'dial-tiny-text';
  const titleClassName = typography?.titleClassName ?? 'dial-body-semi-text';
  const quoteClassName = typography?.quoteClassName ?? 'dial-small-text';
  const switcherClassName = typography?.switcherClassName ?? 'dial-tiny-text';

  const cssVars = buildCssVars({
    '--cc-card-bg': colors?.cardBackground,
    '--cc-quote-text': colors?.quoteText,
    '--cc-title-text': colors?.titleText,
    '--cc-switcher-text': colors?.switcherText,
    '--cc-source-name-text': colors?.sourceNameText,
  });

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={labels.ariaLabel}
      style={cssVars}
      className={mergeClasses(
        'flex w-[400px] flex-col gap-3 rounded-lg p-4 shadow-lg',
        styles.card,
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1">
          {headerIcon}
          <DialEllipsisTooltip
            text={group.sourceName}
            className={mergeClasses(
              sourceNameClassName,
              'min-w-0',
              styles.sourceName,
            )}
          />
        </div>
        {hasSwitcher && (
          <div className="flex shrink-0 items-center gap-1">
            <GhostIconButton
              icon={<IconChevronLeft size={14} className="rtl:scale-x-[-1]" />}
              size={ElementSize.Small}
              aria-label={labels.previousCitation}
              onClick={() => onIndexChange((activeIndex - 1 + total) % total)}
            />
            <span className={mergeClasses(switcherClassName, styles.switcher)}>
              {labels.formatSwitcherText(activeIndex + 1, total)}
            </span>
            <GhostIconButton
              icon={<IconChevronRight size={14} className="rtl:scale-x-[-1]" />}
              size={ElementSize.Small}
              aria-label={labels.nextCitation}
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
                titleClassName,
                styles.title,
                'break-words',
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
                    p: mergeClasses(
                      quoteClassName,
                      'line-clamp-6',
                      styles.quote,
                    ),
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
            label={labels.preview}
            size={ElementSize.Small}
            onClick={() => onPreview(annotation)}
          />
        )}
        <PrimaryButton
          label={isWebLink ? labels.openInBrowser : labels.download}
          size={ElementSize.Small}
          onClick={() => onOpenInBrowser(annotation)}
        />
      </div>
    </div>
  );
};

export default memo(CitationCard);
