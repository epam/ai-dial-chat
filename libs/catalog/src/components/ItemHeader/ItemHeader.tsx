import { Highlight, mergeClasses } from '@epam/ai-dial-chat-shared';
import { DialEllipsisTooltip } from '@epam/ai-dial-ui-kit';
import { FC } from 'react';
import styles from './ItemHeader.module.scss';

interface ItemHeaderProps {
  title: string;
  postfix?: number | string;
  titleClassName?: string;
  postfixClassName?: string;
  className?: string;
  query?: string;
}

export const ItemHeader: FC<ItemHeaderProps> = ({
  title,
  postfix,
  titleClassName = 'dial-h3-text',
  postfixClassName = 'dial-tiny-text',
  className,
  query,
}) => {
  return (
    <div className={mergeClasses('flex items-center gap-2', className)}>
      <h3 className={mergeClasses('min-w-0', titleClassName, styles.title)}>
        {query ? (
          <Highlight text={title} query={query} />
        ) : (
          <DialEllipsisTooltip text={title} />
        )}
      </h3>
      {postfix != null && (
        <DialEllipsisTooltip
          className={mergeClasses(postfixClassName, styles.count)}
          text={postfix}
        />
      )}
    </div>
  );
};
