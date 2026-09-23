import { mergeClasses } from '@epam/ai-dial-chat-shared';
import type { CSSProperties, FC } from 'react';
import type { BuilderFormBodyProps } from '../../models/builder-form-body-props';
import styles from './BuilderFormBody.module.scss';

/* Shared width of the start/end columns, so every builder form lines its side
 * columns up on the same grid. */
const SIDE_COLUMN_CLASS_NAME = mergeClasses('flex flex-col', styles.sideColumn);

/** Builder form body split into start, main, and end columns — stacked on mobile, side by side on desktop. */
export const BuilderFormBody: FC<BuilderFormBodyProps> = ({
  left,
  children,
  metadata,
  layout,
}) => {
  const hasReservedEndColumn =
    left != null && metadata == null && layout?.reserveEndColumn !== false;
  const sideStyle: CSSProperties | undefined = layout
    ? {
        flex: `0 1 ${layout.sideColumnWidth ?? '400px'}`,
        width: '100%',
        minWidth: `min(100%, ${layout.sideColumnWidth ?? '400px'})`,
        maxWidth: '100%',
      }
    : undefined;
  const bodyStyle: CSSProperties | undefined = layout
    ? {
        flexDirection: 'row',
        flexWrap: 'wrap',
        columnGap: layout.columnGap ?? '0px',
        alignItems: 'stretch',
      }
    : undefined;

  return (
    <div
      className={mergeClasses('flex min-w-0 flex-1', styles.body)}
      style={bodyStyle}
    >
      {left != null && (
        <div className={SIDE_COLUMN_CLASS_NAME} style={sideStyle}>
          {left}
        </div>
      )}
      <div
        className="flex w-full min-w-0 flex-1 flex-col"
        style={
          layout
            ? { flex: '1 1 320px', minWidth: 'min(100%, 320px)' }
            : undefined
        }
      >
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
