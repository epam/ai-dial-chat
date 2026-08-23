import { DialEllipsisTooltip, Highlight } from '@epam/ai-dial-ui-kit';
import { FC, ReactNode } from 'react';
import { buildCssVars } from '../../utils/build-css-vars';
import { mergeClasses } from '../../utils/merge-class';
import styles from './ItemHeader.module.scss';

/** CSS custom-property overrides for the `ItemHeader` component. */
export interface ItemHeaderColors {
  /** Title text color. Defaults to `--text-primary`. */
  title?: string;
  /** Postfix text color. Defaults to `--text-secondary`. */
  count?: string;
}

/** Props for `ItemHeader`. */
export interface ItemHeaderProps {
  /** Title text rendered in the heading element. */
  title: string;
  /** Secondary value rendered after the title, such as a version or an item count. */
  postfix?: number | string;
  /** CSS class applied to the title. Defaults to `'dial-h3-text'`. */
  titleClassName?: string;
  /** CSS class applied to the postfix. Defaults to `'dial-tiny-text'`. */
  postfixClassName?: string;
  /** CSS class applied to the header row. */
  className?: string;
  /** Search query; when provided, the matching part of the title is highlighted. */
  query?: string;
  /** Optional content rendered at the trailing end of the header row. */
  trailing?: ReactNode;
  /** Color overrides applied as CSS custom properties. */
  colors?: ItemHeaderColors;
  /**
   * Whether the title shrinks and truncates with an ellipsis. When `false` the
   * title keeps its full width and the rest of the row gives way instead.
   * Defaults to `true`.
   */
  shouldTruncateTitle?: boolean;
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
  colors,
  shouldTruncateTitle = true,
}) => {
  const cssVars = buildCssVars({
    '--ih-title-color': colors?.title,
    '--ih-count-color': colors?.count,
  });

  const renderTitle = () => {
    if (query) {
      return <Highlight text={title} query={query} />;
    }
    if (!shouldTruncateTitle) {
      return title;
    }
    return <DialEllipsisTooltip text={title} />;
  };

  return (
    <div
      className={mergeClasses('flex items-center gap-2', className)}
      style={cssVars}
    >
      <h3
        className={mergeClasses(
          /* `shrink` + `min-w-0` (not `flex-1`) so the title keeps its natural
             width and the postfix stays next to it, while still giving way to
             an ellipsis when the row is too narrow. */
          shouldTruncateTitle ? 'min-w-0 shrink' : 'shrink-0 whitespace-nowrap',
          titleClassName,
          styles.title,
        )}
      >
        {renderTitle()}
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
