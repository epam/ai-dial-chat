import { mergeClasses } from '@epam/ai-dial-chat-shared';
import type { CSSProperties, FC } from 'react';
import type { BuilderFormBodyProps } from '../../models/builder-form-body-props';
import styles from './BuilderFormBody.module.scss';

/* Shared width of the start/end columns, so every builder form lines its side
 * columns up on the same grid. */
const SIDE_COLUMN_CLASS_NAME = mergeClasses(
  'flex flex-col desktop:min-h-0 desktop:overflow-y-auto',
  styles.sideColumn,
);

/** Builder form body with one mobile scroller and independently scrolling desktop columns. */
export const BuilderFormBody: FC<BuilderFormBodyProps> = ({
  left,
  children,
  metadata,
  layout,
}) => {
  const hasReservedEndColumn =
    left != null && metadata == null && layout?.reserveEndColumn !== false;
  const sideStyle: CSSProperties | undefined = layout
    ? ({
        '--bfb-side-column-width': layout.sideColumnWidth ?? '400px',
      } as CSSProperties)
    : undefined;
  const bodyStyle: CSSProperties | undefined = layout
    ? {
        columnGap: layout.columnGap ?? '0px',
      }
    : undefined;

  return (
    <div
      className={mergeClasses(
        'flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto desktop:flex-row desktop:overflow-hidden',
        styles.body,
      )}
      style={bodyStyle}
    >
      {left != null && (
        <div className={SIDE_COLUMN_CLASS_NAME} style={sideStyle}>
          {left}
        </div>
      )}
      <div className="flex w-full min-w-0 flex-1 flex-col desktop:min-h-0 desktop:overflow-y-auto">
        {children}
      </div>
      {metadata != null && (
        <div className={SIDE_COLUMN_CLASS_NAME} style={sideStyle}>
          {metadata}
        </div>
      )}
      {hasReservedEndColumn && (
        <div
          aria-hidden
          style={sideStyle}
          className={mergeClasses(styles.reservedColumn, styles.sideColumn)}
        />
      )}
    </div>
  );
};
