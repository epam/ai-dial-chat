import type { Annotation } from '@epam/ai-dial-chat-shared';
import {
  buildCssVars,
  MarkdownRenderer,
  mergeClasses,
  MIMEType,
} from '@epam/ai-dial-chat-shared';
import {
  DIAL_KIT_ICON_STROKE,
  DialItemType,
  ElementSize,
  EllipsisTooltip,
  FileIcon,
  GhostIconButton,
  LinkButton,
  PrimaryButton,
} from '@epam/ai-dial-ui-kit';
import { IconChevronLeft, IconChevronRight } from '@tabler/icons-react';
import {
  FC,
  ReactNode,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { QUOTATIONS_CLASS } from '../../constants/public-class-names';
import {
  getSourceFileExtension,
  type AnnotationGroup,
} from '../../utils/group-annotations-by-source';
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
  /** Label for the toggle that expands a quote cut off at the collapsed height. */
  showMore: string;
  /** Label for the toggle that collapses an expanded quote. */
  showLess: string;
  /** Accessible label for the copy button on a fenced code block inside the quote. Defaults to `'Copy code'`. */
  codeBlockCopyLabel?: string;
  /** Status announced after a fenced code block inside the quote has been copied. Defaults to `'Copied!'`. */
  codeBlockCopiedLabel?: string;
  /** Accessible label for the download button on a fenced code block inside the quote. Defaults to `'Download code'`. */
  codeBlockDownloadLabel?: string;
  /** Accessible label for a table's horizontally scrollable region inside the quote. Defaults to `'Scrollable table'`. */
  tableScrollRegionAriaLabel?: string;
  /** Accessible label for a block formula's horizontally scrollable region inside the quote. Defaults to `'Scrollable formula'`. */
  mathScrollRegionAriaLabel?: string;
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
  /** CSS class applied to bold spans inside the quoted excerpt. Defaults to `'dial-small-semi-text'` — the semibold step matching the default `quoteClassName`. */
  quoteStrongClassName?: string;
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
  /** Whether a previewable file shows the "Download" button. Web links keep "Open in browser" regardless. Defaults to `true`. */
  isDownloadEnabled?: boolean;
  /**
   * Optional icon rendered before the header text (the file extension for a
   * previewable file, otherwise the source name). When omitted, a previewable
   * file gets the UI kit's `FileIcon` glyph for its extension.
   */
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
  isDownloadEnabled = true,
  headerIcon,
  labels,
  typography,
  colors,
}) => {
  const total = group.annotations.length;
  const annotation = group.annotations[activeIndex] ?? group.primaryAnnotation;
  const hasSwitcher = total > 1;
  const sourceContentType = annotation.body?.source?.attachment?.type;
  const isWebLink =
    onPreview == null ||
    sourceContentType === MIMEType.HTML ||
    sourceContentType === MIMEType.XHTML;
  const fileExtension = isWebLink
    ? undefined
    : getSourceFileExtension(annotation);
  const headerText = fileExtension ?? group.sourceName;
  const resolvedHeaderIcon =
    headerIcon ??
    (fileExtension != null ? (
      <FileIcon
        type={DialItemType.File}
        name={fileExtension}
        fileExtension={fileExtension}
        size={16}
        decorative
        className="shrink-0"
      />
    ) : undefined);

  const sourceNameClassName =
    typography?.sourceNameClassName ?? 'dial-tiny-text';
  const titleClassName = typography?.titleClassName ?? 'dial-body-semi-text';
  const quoteClassName = typography?.quoteClassName ?? 'dial-small-text';
  const quoteStrongClassName =
    typography?.quoteStrongClassName ?? 'dial-small-semi-text';
  const switcherClassName = typography?.switcherClassName ?? 'dial-tiny-text';

  const cssVars = buildCssVars({
    '--cc-card-bg': colors?.cardBackground,
    '--cc-quote-text': colors?.quoteText,
    '--cc-title-text': colors?.titleText,
    '--cc-switcher-text': colors?.switcherText,
    '--cc-source-name-text': colors?.sourceNameText,
  });

  const quote = annotation.body?.quote;
  const quoteId = useId();
  const quoteRef = useRef<HTMLDivElement>(null);
  const [isQuoteExpanded, setIsQuoteExpanded] = useState(false);
  const [isQuoteClamped, setIsQuoteClamped] = useState(false);

  /* Every citation opens collapsed, including one reached via the switcher. */
  useEffect(() => {
    setIsQuoteExpanded(false);
  }, [activeIndex, quote]);

  /* The toggle only appears when the collapsed quote actually overflows its
   * line clamp. Measuring is skipped while expanded so "Show less" stays
   * available; re-measuring on resize covers font loading and width changes. */
  useLayoutEffect(() => {
    const element = quoteRef.current;
    if (!element || isQuoteExpanded) return;

    const measure = () =>
      setIsQuoteClamped(element.scrollHeight > element.clientHeight + 1);
    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [quote, isQuoteExpanded]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={labels.ariaLabel}
      style={cssVars}
      className={mergeClasses(
        'flex w-[400px] max-w-full flex-col gap-3 rounded-lg p-4 shadow-lg',
        styles.card,
        QUOTATIONS_CLASS.citationCard,
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1">
          {resolvedHeaderIcon}
          <EllipsisTooltip
            text={headerText}
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
              icon={
                <IconChevronLeft
                  size={14}
                  className="rtl:scale-x-[-1]"
                  stroke={DIAL_KIT_ICON_STROKE}
                />
              }
              size={ElementSize.Small}
              aria-label={labels.previousCitation}
              onClick={() => onIndexChange((activeIndex - 1 + total) % total)}
            />
            <span className={mergeClasses(switcherClassName, styles.switcher)}>
              {labels.formatSwitcherText(activeIndex + 1, total)}
            </span>
            <GhostIconButton
              icon={
                <IconChevronRight
                  size={14}
                  className="rtl:scale-x-[-1]"
                  stroke={DIAL_KIT_ICON_STROKE}
                />
              }
              size={ElementSize.Small}
              aria-label={labels.nextCitation}
              onClick={() => onIndexChange((activeIndex + 1) % total)}
            />
          </div>
        )}
      </div>

      {(annotation.body?.title || annotation.body?.quote || hasSwitcher) && (
        <div className="flex flex-col gap-3">
          {annotation.body?.title && (
            <p
              className={mergeClasses(
                titleClassName,
                styles.title,
                'break-words',
              )}
            >
              {annotation.body.title}
            </p>
          )}
          {(quote || hasSwitcher) && (
            <div className="flex flex-col items-start gap-1">
              <div
                ref={quoteRef}
                id={quoteId}
                /* An expanded quote scrolls, and a scrollable region must be
                 * reachable from the keyboard. */
                tabIndex={isQuoteExpanded ? 0 : undefined}
                className={mergeClasses(
                  quoteClassName,
                  styles.quote,
                  'w-full break-words',
                  isQuoteExpanded
                    ? 'max-h-[min(20rem,50vh)] overflow-y-auto'
                    : 'line-clamp-6',
                )}
              >
                {quote && (
                  <MarkdownRenderer
                    content={quote}
                    classNames={{
                      p: mergeClasses(quoteClassName, styles.quote),
                      ul: mergeClasses(quoteClassName, 'ps-[1.5em]'),
                      ol: quoteClassName,
                      strong: quoteStrongClassName,
                    }}
                    codeBlockCopyLabel={labels.codeBlockCopyLabel}
                    codeBlockCopiedLabel={labels.codeBlockCopiedLabel}
                    codeBlockDownloadLabel={labels.codeBlockDownloadLabel}
                    tableScrollRegionAriaLabel={
                      labels.tableScrollRegionAriaLabel
                    }
                    mathScrollRegionAriaLabel={labels.mathScrollRegionAriaLabel}
                  />
                )}
              </div>
              {isQuoteClamped && (
                <LinkButton
                  label={isQuoteExpanded ? labels.showLess : labels.showMore}
                  size={ElementSize.Small}
                  aria-expanded={isQuoteExpanded}
                  aria-controls={quoteId}
                  onClick={() => setIsQuoteExpanded((expanded) => !expanded)}
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
        {(isWebLink || isDownloadEnabled) && (
          <PrimaryButton
            label={isWebLink ? labels.openInBrowser : labels.download}
            size={ElementSize.Small}
            onClick={() => onOpenInBrowser(annotation)}
          />
        )}
      </div>
    </div>
  );
};
