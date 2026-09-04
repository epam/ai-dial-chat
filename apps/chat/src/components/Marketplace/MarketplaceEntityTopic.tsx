import classNames from 'classnames';

import { getTopicColors } from '@/src/utils/app/style-helpers';

interface Props {
  topic: string;
  className?: string;
  /**
   * Caps how wide the pill may grow before its label is truncated with an
   * ellipsis. Without a cap a long topic is an indivisible atom that either
   * fits whole or is pushed into the `+N` counter, leaving the row half empty.
   *
   * Truncation is done in plain CSS rather than with a tooltip component on
   * purpose: the pill must contain a single text node, since e2e assertions
   * read the topic name from this element's inner text.
   */
  maxWidth?: number;
  /**
   * Suppresses the hover title holding the full topic name. Set it where the
   * name is already shown in full, e.g. inside the `+N` counter's own tooltip.
   */
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
        'shrink-0 items-center self-start overflow-hidden text-ellipsis text-nowrap rounded border border-accent-primary px-1.5 py-1 text-xs leading-3',
        className,
      )}
      style={{ ...getTopicColors(topic), maxWidth }}
      {...(!hideTooltip && { title: topic })}
      data-qa="entity-topic"
    >
      {topic}
    </span>
  );
};
