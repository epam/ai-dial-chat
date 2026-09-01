import classNames from 'classnames';

import { getTopicColors } from '@/src/utils/app/style-helpers';

import { DialEllipsisTooltip } from '@epam/ai-dial-ui-kit';

interface Props {
  topic: string;
  className?: string;
  maxWidth?: number;
  hideTooltip?: boolean;
}

export const MarketplaceEntityTopic = ({
  topic,
  className,
  maxWidth,
  hideTooltip,
}: Props) => {
  return (
    <span
      className={classNames(
        'shrink-0 items-center self-start text-nowrap rounded border border-accent-primary px-1.5 py-1 text-xs leading-3',
        className,
      )}
      style={{ ...getTopicColors(topic), maxWidth }}
      data-qa="entity-topic"
    >
      <DialEllipsisTooltip
        text={topic}
        hideTooltip={hideTooltip}
        id="entity-topic-name"
      />
    </span>
  );
};
