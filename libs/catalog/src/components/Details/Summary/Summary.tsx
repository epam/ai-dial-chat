import { mergeClasses } from '@epam/ai-dial-chat-shared';
import { FC } from 'react';
import { CatalogItem } from '../../../models/catalog-item';
import {
  ItemDetailsStyles,
  ItemDetailsTexts,
} from '../../../models/item-details-props';
import { TopicTag } from '../../TopicTag/TopicTag';
import styles from '../DetailsPanel.module.scss';
import { AboutTab } from '../TabsContent/About';
import { Limits } from './Limits';

interface SummaryProp {
  item: CatalogItem;
  texts?: ItemDetailsTexts;
  detailsStyles?: ItemDetailsStyles;
}

/** Right-side slide-in panel summary: description, topics, and usage limits. */
export const Summary: FC<SummaryProp> = ({ item, texts, detailsStyles }) => {
  return (
    <div className="flex shrink-0 flex-col gap-5 px-[22px] py-4">
      <div className="flex flex-col gap-2.5">
        <span
          className={mergeClasses('dial-caption-text', styles.aboutCaption)}
        >
          {texts?.tabAboutLabel ?? 'About'}
        </span>
        <AboutTab content={item.description} detailsStyles={detailsStyles} />
      </div>
      {item.topics.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {item.topics.map((p) => (
            <TopicTag key={p} label={p} />
          ))}
        </div>
      )}
      {item.summary != null && (
        <Limits
          summary={item.summary}
          dailyLimitLabel={texts?.dailyLimitLabel ?? 'Daily limit'}
        />
      )}
    </div>
  );
};
