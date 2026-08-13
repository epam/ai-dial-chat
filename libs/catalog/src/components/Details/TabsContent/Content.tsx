import {
  MarkdownWithPlaceholders,
  mergeClasses,
} from '@epam/ai-dial-chat-shared';
import { FC } from 'react';
import type { ItemDetailsStyles } from '../../../models/item-details-props';
import styles from './Content.module.scss';

/** Props for ContentTab. */
export interface ContentTabProps {
  /** The item's full text body, rendered read-only as markdown. */
  content: string;
  /** Short summary shown above the body. Omitted when empty. */
  description?: string;
  /** Color and typography overrides for the body text, headings, and placeholder highlights. */
  detailsStyles?: ItemDetailsStyles;
}

/**
 * Renders a catalog item's summary and its long-form body as read-only
 * markdown, with `{{placeholder}}` tokens highlighted.
 */
export const ContentTab: FC<ContentTabProps> = ({
  content,
  description,
  detailsStyles,
}) => {
  const bodyClassName =
    detailsStyles?.typography?.contentClassName ?? 'dial-small-text';
  const headingClassName =
    detailsStyles?.typography?.contentHeadingClassName ??
    'dial-small-semi-text';

  const hasDescription = description != null && description !== '';

  return (
    <div className="flex h-full flex-col gap-4 pb-6">
      {hasDescription && (
        <>
          <p className={mergeClasses('m-0', bodyClassName)}>{description}</p>
          <div className={mergeClasses('shrink-0', styles.divider)} />
        </>
      )}

      <div
        className={mergeClasses(
          'min-h-0 flex-1 overflow-auto break-words text-start',
          styles.body,
          bodyClassName,
        )}
      >
        <MarkdownWithPlaceholders
          content={content}
          headingClassName={headingClassName}
        />
      </div>
    </div>
  );
};
