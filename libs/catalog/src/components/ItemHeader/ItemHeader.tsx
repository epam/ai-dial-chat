import { mergeClasses } from '@epam/ai-dial-chat-shared';
import { DialEllipsisTooltip } from '@epam/ai-dial-ui-kit';
import { FC } from 'react';
import styles from './ItemHeader.module.scss';

interface ItemHeaderProps {
  title: string;
  count?: number;
  titleClassName?: string;
  countClassName?: string;
  className?: string;
}

export const ItemHeader: FC<ItemHeaderProps> = ({
  title,
  count,
  countClassName,
  titleClassName,
  className,
}) => {
  return (
    <div className={mergeClasses('flex items-center gap-2', className)}>
      <h3 className={mergeClasses(titleClassName, styles.title)}>{title}</h3>
      {count != null && (
        <DialEllipsisTooltip
          className={mergeClasses(countClassName, styles.count)}
          text={count}
        />
      )}
    </div>
  );
};
