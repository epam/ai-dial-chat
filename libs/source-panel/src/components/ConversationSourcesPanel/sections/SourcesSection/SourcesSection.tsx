import { mergeClasses } from '@epam/ai-dial-chat-shared';
import {
  DIAL_ICON_SIZE,
  DialGhostIconButton,
  ElementSize,
} from '@epam/ai-dial-ui-kit';
import { IconCopy } from '@tabler/icons-react';
import { memo, type FC } from 'react';
import type { QuotationSource } from '../../../../models/quotation-source';

interface SourcesSectionProps {
  title: string;
  sources: QuotationSource[];
  copyLabel: string;
  /** CSS class applied to the section heading. Defaults to `'dial-body-semi-text'`. */
  titleClassName?: string;
  /** CSS class applied to each source link. Defaults to `'dial-small-text !text-accent-primary'`. */
  linkClassName?: string;
  /** CSS class applied to the quote text. Defaults to `'dial-tiny-text text-secondary'`. */
  quoteClassName?: string;
  /** When provided, called on source link click instead of following the href. */
  onSourceClick?: (source: QuotationSource) => void;
}

const SourcesSection: FC<SourcesSectionProps> = ({
  title,
  sources,
  copyLabel,
  titleClassName = 'dial-body-semi-text',
  linkClassName = 'dial-small-text !text-accent-primary',
  quoteClassName = 'dial-tiny-text text-secondary',
  onSourceClick,
}) => {
  if (sources.length === 0) {
    return null;
  }

  return (
    <section className="mb-6">
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
                {source.title}
              </a>
              <DialGhostIconButton
                size={ElementSize.Small}
                icon={<IconCopy size={DIAL_ICON_SIZE.SM} stroke={1.5} />}
                aria-label={copyLabel}
                onClick={() => navigator.clipboard.writeText(source.url)}
              />
            </div>
            {source.quote && (
              <p
                className={mergeClasses(
                  quoteClassName,
                  'line-clamp-5 max-h-[80px] overflow-hidden',
                )}
              >
                {source.quote}
              </p>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
};

export default memo(SourcesSection);
