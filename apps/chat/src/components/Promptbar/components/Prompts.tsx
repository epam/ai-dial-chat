import { FC, memo, useMemo } from 'react';

import { useSectionToggle } from '@/src/hooks/useSectionToggle';
import { useTranslation } from '@/src/hooks/useTranslation';

import { FeatureType } from '@/src/types/common';
import { PromptInfo } from '@/src/types/prompt';
import { Translation } from '@/src/types/translation';

import { useAppSelector } from '@/src/store/hooks';
import { UISelectors } from '@/src/store/selectors';

import { RECENT_PROMPTS_SECTION_NAME } from '@/src/constants/sections';

import { CollapsibleSection } from '@/src/components/Common/CollapsibleSection';

import { PromptComponent } from './Prompt';

interface Props {
  prompts: PromptInfo[];
}

const PromptsView: FC<Props> = ({ prompts }) => {
  const { t } = useTranslation(Translation.Chat);
  const visibleSidebarItemsCount = useAppSelector((state) =>
    UISelectors.selectVisibleSidebarItems(state, FeatureType.Prompt),
  );

  const { handleToggle, isExpanded } = useSectionToggle(
    RECENT_PROMPTS_SECTION_NAME,
    FeatureType.Prompt,
  );

  const additionalPromptData = useMemo(
    () => ({
      isSidePanelItem: true,
    }),
    [],
  );

  const promptsToDisplay = useMemo(() => {
    return [...prompts].reverse().slice(0, visibleSidebarItemsCount);
  }, [prompts, visibleSidebarItemsCount]);

  if (!promptsToDisplay.length) {
    return null;
  }

  return (
    <CollapsibleSection
      name={t(RECENT_PROMPTS_SECTION_NAME)}
      onToggle={handleToggle}
      openByDefault={isExpanded}
      isExpanded={isExpanded}
      dataQa="prompts-section"
    >
      <div
        className="flex size-full flex-col gap-1 py-1 pe-0.5"
        data-qa="prompts"
      >
        {promptsToDisplay.map((prompt) => (
          <PromptComponent
            key={prompt.id}
            item={prompt}
            additionalItemData={additionalPromptData}
          />
        ))}
      </div>
    </CollapsibleSection>
  );
};

export const Prompts = memo(PromptsView);
