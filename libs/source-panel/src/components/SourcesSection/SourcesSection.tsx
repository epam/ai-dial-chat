import {
  buildCssVars,
  MarkdownRenderer,
  mergeClasses,
} from '@epam/ai-dial-chat-shared';
import {
  DIAL_ICON_SIZE,
  ElementSize,
  GhostIconButton,
  Highlight,
} from '@epam/ai-dial-ui-kit';
import { IconCopy } from '@tabler/icons-react';
import { memo, useMemo, useState, type FC, type ReactNode } from 'react';
import type { QuotationSource } from '../../models/quotation-source';
import {
  ConversationSourcesPanelColors,
  ConversationSourcesPanelTypography,
} from '../ConversationSourcesPanel/ConversationSourcesPanel';
import styles from './SourcesSection.module.scss';

/** Props for the `SourcesSection` component. */
export interface SourcesSectionProps {
  /** Heading text for the sources section. */
  title: ReactNode;
  /** List of sources to display. */
  sources: QuotationSource[];
  /** Accessible label for each source's copy-URL button. */
  copyLabel: string;
  /** Status message announced to assistive tech after a source URL is copied. Defaults to `'Link copied to clipboard'`. */
  copiedLabel?: string;
  /** Current search query — used to highlight matches in source titles and quotes. */
  searchQuery?: string;
  /** Typography (font utility class) overrides for section headings and source text. */
  typography?: ConversationSourcesPanelTypography;
  /** Color overrides applied as CSS custom properties. */
  colors?: ConversationSourcesPanelColors;
  /** When provided, called on source link click instead of following the href. */
  onSourceClick?: (source: QuotationSource) => void;
}

/** Cited-sources list section (with copy-URL action) rendered inside `ConversationSourcesPanel`. Renders nothing when `sources` is empty. */
const SourcesSection: FC<SourcesSectionProps> = ({
  title,
  sources,
  copyLabel,
  copiedLabel = 'Link copied to clipboard',
  searchQuery = '',
  typography,
  colors,
  onSourceClick,
}) => {
  const [copyStatus, setCopyStatus] = useState('');

  const titleClassName =
    typography?.sectionTitleClassName ?? 'dial-body-semi-text';
  const linkClassName = typography?.sourceLinkClassName ?? 'dial-small-text';
  const quoteClassName = typography?.sourceQuoteClassName ?? 'dial-tiny-text';

  const sectionCssVars = useMemo(
    () =>
      buildCssVars({
        '--sp-source-link': colors?.sourceLink,
        '--sp-source-quote': colors?.sourceQuote,
      }),
    [colors],
  );

  if (sources.length === 0) {
    return null;
  }

  const handleCopy = async (url: string) => {
    await navigator.clipboard.writeText(url);
    setCopyStatus(copiedLabel);
  };

  return (
    <section className="mb-6" style={sectionCssVars}>
      <h2 className={mergeClasses(titleClassName, 'mb-3')}>{title}</h2>
      <ul className="flex flex-col gap-3">
        {sources.map((source) => (
          <li key={source.url} className="flex flex-col gap-1">
            <div className="flex min-w-0 items-center justify-between gap-2">
              <a
                href={source.url}
                target="_blank"
                rel="noopener noreferrer"
                className={mergeClasses(
                  linkClassName,
                  styles.link,
                  'min-w-0 flex-1 truncate',
                )}
                onClick={
                  onSourceClick
                    ? (e) => {
                        e.preventDefault();
                        onSourceClick(source);
                      }
                    : undefined
                }
              >
                {searchQuery ? (
                  <Highlight
                    text={source.title}
                    query={searchQuery}
                    maxLines={1}
                  />
                ) : (
                  source.title
                )}
              </a>
              <GhostIconButton
                size={ElementSize.Small}
                icon={
                  <IconCopy size={DIAL_ICON_SIZE.SM} stroke={1.5} aria-hidden />
                }
                aria-label={copyLabel}
                onClick={() => void handleCopy(source.url)}
              />
            </div>
            {source.quote && (
              <div
                className={mergeClasses(
                  quoteClassName,
                  styles.quote,
                  'line-clamp-5 [&>div>*+*]:mt-1',
                )}
              >
                <MarkdownRenderer content={source.quote} />
              </div>
            )}
          </li>
        ))}
      </ul>
      <span role="status" aria-live="polite" className="sr-only">
        {copyStatus}
      </span>
    </section>
  );
};

export default memo(SourcesSection);
