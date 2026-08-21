import {
  MarkdownRenderer,
  type MarkdownRendererClassNames,
} from '@epam/ai-dial-chat-shared';
import { FC } from 'react';
import type { ItemDetailsStyles } from '../../../models/item-details-props';
import { TopicTag } from '../../TopicTag/TopicTag';

interface AboutTabProps {
  topics?: string[];
  /** Markdown text to render, typically `item.description`. */
  content: string;
  detailsStyles?: ItemDetailsStyles;
}

/** Renders a catalog item's description as markdown, followed by its topic tags. */
export const AboutTab: FC<AboutTabProps> = ({
  topics,
  content,
  detailsStyles,
}) => {
  const headingClassName =
    detailsStyles?.typography?.contentHeadingClassName ??
    'dial-small-semi-text';
  const bodyClassName =
    detailsStyles?.typography?.contentClassName ?? 'dial-small-text';

  const classNames: MarkdownRendererClassNames = {
    h1: headingClassName,
    h2: headingClassName,
    h3: headingClassName,
    h4: headingClassName,
    h5: headingClassName,
    h6: headingClassName,
    p: bodyClassName,
    ul: bodyClassName,
    ol: bodyClassName,
  };

  return (
    <div className="flex flex-col gap-5">
      <MarkdownRenderer content={content} classNames={classNames} />
      {topics && topics.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {topics.map((p) => (
            <TopicTag key={p} label={p} />
          ))}
        </div>
      )}
    </div>
  );
};
