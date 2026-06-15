import { useState } from 'react';

import classNames from 'classnames';

import { useTranslation } from '@/src/hooks/useTranslation';

import { Translation } from '@/src/types/translation';

import { ChatI18nKeys } from '@/src/constants/i18n';

import { MessageStage } from './MessageStage';

import ChevronDown from '@/public/images/icons/chevron-down.svg';
import { Stage } from '@epam/ai-dial-shared';
import { DialButton } from '@epam/ai-dial-ui-kit';

interface Props {
  stages: Stage[];
}

const NUMBER_OF_VISIBLE_STAGES = 3;

export const MessageStages = ({ stages }: Props) => {
  const { t } = useTranslation(Translation.Chat);
  const [showMore, setShowMore] = useState(false);

  const displayedStages = stages.slice(
    0,
    showMore ? stages.length : NUMBER_OF_VISIBLE_STAGES,
  );

  return (
    <div className="flex flex-col gap-1">
      {displayedStages.map((stage) => (
        <MessageStage key={stage.index} stage={stage} />
      ))}
      {stages.length > NUMBER_OF_VISIBLE_STAGES && (
        <div>
          <DialButton
            onClick={() => setShowMore(!showMore)}
            className="mt-2 flex leading-[18px] text-accent-primary"
            textClassName="font-normal"
            data-no-context-menu
            data-qa={showMore ? 'show-less' : 'show-more'}
            label={
              showMore ? t(ChatI18nKeys.ShowLess) : t(ChatI18nKeys.ShowMore)
            }
            iconAfter={
              <ChevronDown
                height={18}
                width={18}
                className={classNames(
                  'shrink-0 transition',
                  showMore && 'rotate-180',
                )}
              />
            }
          />
        </div>
      )}
    </div>
  );
};
