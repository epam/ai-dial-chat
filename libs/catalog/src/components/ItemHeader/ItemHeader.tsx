import { mergeClasses } from '@epam/ai-dial-chat-shared';
import { DialEllipsisTooltip, Highlight } from '@epam/ai-dial-ui-kit';
import { FC, ReactNode } from 'react';
import styles from './ItemHeader.module.scss';

interface ItemHeaderProps {
  title: string;
  postfix?: number | string;
  titleClassName?: string;
  postfixClassName?: string;
  className?: string;
  query?: string;
  /** Optional content rendered at the trailing end of the header row. */
  trailing?: ReactNode;
}

/** Item title header with optional numeric or string postfix and trailing slot. */
export const ItemHeader: FC<ItemHeaderProps> = ({
  title,
  postfix,
  titleClassName = 'dial-h3-text',
  postfixClassName = 'dial-tiny-text',
  className,
  query,
  trailing,
}) => {
  return (
    <div className={mergeClasses('flex items-center gap-2', className)}>
      <h3
        className={mergeClasses('min-w-0 flex-1', titleClassName, styles.title)}
      >
        {query ? (
          <Highlight text={title} query={query} />
        ) : (
          <DialEllipsisTooltip text={title} />
        )}
      </h3>
      {postfix != null && (
        /* Capped at 30% of the row so a long version truncates instead of
           squeezing the title out of the header. */
        <DialEllipsisTooltip
          className={mergeClasses(
            'max-w-[30%] shrink-0',
            postfixClassName,
            styles.count,
          )}
          text={postfix}
        />
      )}
      {trailing != null && <div className="ms-auto">{trailing}</div>}
    </div>
  );
};
