import type { FC } from 'react';
import type { BuilderFormBodyProps } from '../../models/builder-form-body-props';

/* Shared width of the start/end columns, so every builder form lines its side
 * columns up on the same grid. */
const SIDE_COLUMN_CLASS_NAME =
  'flex w-full flex-col desktop:w-[360px] desktop:shrink-0';

/** Builder form body split into start, main, and end columns — stacked on mobile, side by side on desktop. */
export const BuilderFormBody: FC<BuilderFormBodyProps> = ({
  left,
  children,
  metadata,
}) => {
  const hasReservedEndColumn = left != null && metadata == null;

  return (
    <div className="flex flex-1 flex-col desktop:flex-row">
      {left != null && <div className={SIDE_COLUMN_CLASS_NAME}>{left}</div>}
      <div className="flex w-full min-w-0 flex-1 flex-col">{children}</div>
      {metadata != null && (
        <div className={SIDE_COLUMN_CLASS_NAME}>{metadata}</div>
      )}
      {hasReservedEndColumn && (
        <div
          aria-hidden
          className="hidden desktop:block desktop:w-[360px] desktop:shrink-0"
        />
      )}
    </div>
  );
};
