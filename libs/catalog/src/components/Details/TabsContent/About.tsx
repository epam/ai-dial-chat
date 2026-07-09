import { mergeClasses } from '@epam/ai-dial-chat-shared';
import { FC, useMemo } from 'react';
import type { ItemDetailsStyles } from '../../../models/item-details-props';
import type { AboutRun } from '../../../utils/parse-about-content';
import { parseAboutContent } from '../../../utils/parse-about-content';

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
  /** Raw text to render (bullets/headings are parsed from it). The caller decides whether this is `intro`, `description`, or a fallback between the two. */
  content: string;
  detailsStyles?: ItemDetailsStyles;
}

/** Renders parsed about-style content (headings/bullets) for a catalog item. */
export const AboutTab: FC<AboutTabProps> = ({ content, detailsStyles }) => {
  const {
    contentHeadingClassName = 'dial-small-semi-text',
    contentClassName = 'dial-small-text',
  } = detailsStyles?.typography ?? {};

  const parsedAboutBlocks = useMemo(
    () => parseAboutContent(content),
    [content],
  );

  return (
    <div className="flex flex-col gap-5">
      {parsedAboutBlocks.map((block, blockIdx) => (
        <div key={blockIdx} className="flex flex-col gap-2">
          {block.heading != null && (
            <span className={contentHeadingClassName}>{block.heading}</span>
          )}
          {block.runs.map((run, runIdx) => (
            <AboutRunView
              key={runIdx}
              run={run}
              contentClassName={contentClassName}
            />
          ))}
        </div>
      ))}
    </div>
  );
};
