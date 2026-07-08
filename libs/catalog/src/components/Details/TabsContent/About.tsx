import { mergeClasses } from '@epam/ai-dial-chat-shared';
import { FC, useMemo } from 'react';
import { CatalogItem } from '../../../models/catalog-item';
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
  item: CatalogItem;
  detailsStyles?: ItemDetailsStyles;
}

/** Intro content for a catalog item (`item.intro`, falling back to `item.description`). */
export const AboutTab: FC<AboutTabProps> = ({ item, detailsStyles }) => {
  const {
    contentHeadingClassName = 'dial-small-semi-text',
    contentClassName = 'dial-small-text',
  } = detailsStyles?.typography ?? {};

  const parsedAboutBlocks = useMemo(
    () => parseAboutContent(item.intro ?? item.description),
    [item.intro, item.description],
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
