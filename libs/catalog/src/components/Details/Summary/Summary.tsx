import { FC } from 'react';
import { CatalogItem } from '../../../models/catalog-item';
import { ItemDetailsTexts } from '../../../models/item-details-props';
import { TopicTag } from '../../TopicTag/TopicTag';
import { Limits } from './Limits';

interface SummaryProp {
  item: CatalogItem;
  texts?: ItemDetailsTexts;
}

/** Right-side slide-in panel summary: topics, and usage limits. */
export const Summary: FC<SummaryProp> = ({ item, texts }) => {
  return item.topics.length > 0 || item.summary != null ? (
    <div className="flex shrink-0 flex-col gap-5 px-[22px]">
      {item.topics.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {item.topics.map((p) => (
            <TopicTag key={p} label={p} />
          ))}
        </div>
      )}
      {/* TODO: check to usage */}
      {item.summary != null && (
        <Limits
          summary={item.summary}
          dailyLimitLabel={texts?.dailyLimitLabel ?? 'Daily limit'}
        />
      )}
    </div>
  ) : null;
};
