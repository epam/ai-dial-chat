import { Highlight, mergeClasses } from '@epam/ai-dial-chat-shared';
import { DialEllipsisTooltip } from '@epam/ai-dial-ui-kit';
import { FC } from 'react';
import styles from './ItemHeader.module.scss';

interface ItemHeaderProps {
  title: string;
  count?: number | string;
  titleClassName?: string;
  countClassName?: string;
  className?: string;
  query?: string;
}

export const ItemHeader: FC<ItemHeaderProps> = ({
  title,
  count,
  countClassName,
  titleClassName,
  className,
  query,
}) => {
  return (
    <div className={mergeClasses('flex items-center gap-2', className)}>
      <h3 className={mergeClasses(titleClassName, styles.title)}>
        {query ? <Highlight text={title} query={query} /> : title}
      </h3>
      {count != null && (
        <DialEllipsisTooltip
          className={mergeClasses(countClassName, styles.count)}
          text={count}
        />
      )}
    </div>
  );
};
