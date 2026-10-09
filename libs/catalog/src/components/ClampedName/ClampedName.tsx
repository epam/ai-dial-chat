import { mergeClasses } from '@epam/ai-dial-chat-shared';
import { Highlight, Tooltip } from '@epam/ai-dial-ui-kit';
import { FC } from 'react';
import { useIsVerticallyClamped } from '../../hooks/useIsVerticallyClamped/useIsVerticallyClamped';

/** Props for `ClampedName`. */
export interface ClampedNameProps {
  /** Entity name to render. */
  name: string;
  /** Search query highlighted inside the name. Defaults to `''`. */
  query?: string;
  /** CSS classes for the name element: typography, color, and its share of the row. */
  className?: string;
}

/** Entity name wrapped onto at most two lines, with the full name in a tooltip only while it is clipped. */
export const ClampedName: FC<ClampedNameProps> = ({
  name,
  query = '',
  className,
}) => {
  const { ref, isClamped } = useIsVerticallyClamped<HTMLSpanElement>(name);

  /*
   * The clamp lives on this wrapper, not on `Highlight`'s own `maxLines`: the
   * kit's stylesheet orders `.block` after `.line-clamp-2`, so the `display:
   * block` its ellipsis span also carries cancels that clamp. `Highlight` only
   * marks the query here, and its own width-based ellipsis tooltip never
   * fires for wrapped text, so the clipped name gets this tooltip instead
   * ([#9121](https://github.com/epam/ai-dial-chat/issues/9121)).
   */
  return (
    <Tooltip asChild tooltip={name} hideTooltip={!isClamped}>
      <span
        ref={ref}
        className={mergeClasses('line-clamp-2 min-w-0 break-words', className)}
      >
        <Highlight text={name} query={query} />
      </span>
    </Tooltip>
  );
};
