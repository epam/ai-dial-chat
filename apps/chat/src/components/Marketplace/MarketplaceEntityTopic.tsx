import classNames from 'classnames';

import { getTopicColors } from '@/src/utils/app/style-helpers';

interface Props {
  topic: string;
  className?: string;
}

export const MarketplaceEntityTopic = ({ topic, className }: Props) => {
  return (
    <span
      className={classNames(
        'shrink-0 items-center self-start text-nowrap rounded border border-accent-primary px-1.5 py-1 text-xs leading-3',
        className,
      )}
      style={getTopicColors(topic)}
      data-qa="entity-topic"
    >
      {topic}
    </span>
  );
};
