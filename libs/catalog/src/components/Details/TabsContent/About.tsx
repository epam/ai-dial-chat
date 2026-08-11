import { mergeClasses } from '@epam/ai-dial-chat-shared';
import { FC, useMemo } from 'react';
import type { ItemDetailsStyles } from '../../../models/item-details-props';
import type { AboutRun } from '../../../utils/parse-about-content';
import { parseAboutContent } from '../../../utils/parse-about-content';
import { TopicTag } from '../../TopicTag/TopicTag';

interface AboutRunViewProps {
  run: AboutRun;
  contentClassName: string;
}

const AboutRunView: FC<AboutRunViewProps> = ({ run, contentClassName }) => {
  if (run.kind === 'bullets') {
    return (
      <ul className="m-0 flex list-none flex-col gap-1 ps-0">
        {run.items.map((text, i) => (
          <li key={i} className={mergeClasses('flex gap-2', contentClassName)}>
            <span aria-hidden="true">•</span>
            <span>{text}</span>
          </li>
        ))}
      </ul>
    );
  }
  return <p className={mergeClasses('m-0', contentClassName)}>{run.text}</p>;
};

interface AboutTabProps {
  topics?: string[];
  /** Raw text to render (bullets/headings are parsed from it), typically `item.description`. */
  content: string;
  detailsStyles?: ItemDetailsStyles;
}

/** Renders parsed about-style content (headings/bullets) for a catalog item. */
export const AboutTab: FC<AboutTabProps> = ({
  topics,
  content,
  detailsStyles,
}) => {
  const parsedAboutBlocks = useMemo(
    () => parseAboutContent(content),
    [content],
  );

  return (
    <div className="flex flex-col gap-5">
      {parsedAboutBlocks.map((block, blockIdx) => (
        <div key={blockIdx} className="flex flex-col gap-2">
          {block.heading != null && (
            <span
              className={
                detailsStyles?.typography?.contentHeadingClassName ??
                'dial-small-semi-text'
              }
            >
              {block.heading}
            </span>
          )}
          {block.runs.map((run, runIdx) => (
            <AboutRunView
              key={runIdx}
              run={run}
              contentClassName={
                detailsStyles?.typography?.contentClassName ?? 'dial-small-text'
              }
            />
          ))}
        </div>
      ))}
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
