import { DIAL_ICON_SIZE, DialGhostIconButton, ElementSize } from '@epam/ai-dial-ui-kit';
import { IconCopy } from '@tabler/icons-react';
import { memo, type FC } from 'react';
import type { QuotationSource } from '../../../../models/quotation-source';

interface Props {
  title: string;
  sources: QuotationSource[];
  copyLabel: string;
}

const SourcesSection: FC<Props> = ({ title, sources, copyLabel }) => {
  if (sources.length === 0) {
    return null;
  }

  return (
    <section className="mb-6">
      <h2 className="dial-body-semi-text mb-3">{title}</h2>
      <ul className="flex flex-col gap-3">
        {sources.map((source) => (
          <li key={source.url} className="flex flex-col gap-1">
            <div className="flex min-w-0 items-center justify-between gap-2">
              <a
                href={source.url}
                target="_blank"
                rel="noopener noreferrer"
                className="dial-small-text !text-accent-primary min-w-0 flex-1 truncate"
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
              <p className="dial-tiny-text text-secondary line-clamp-5 max-h-[80px] overflow-hidden">
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
