import { useCallback } from 'react';

import { useTranslation } from 'next-i18next';

import { FeatureType } from '@/src/types/common';
import { Prompt } from '@/src/types/prompt';
import { SearchFilters } from '@/src/types/search';
import { Translation } from '@/src/types/translation';

import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import {
  PromptsActions,
  PromptsSelectors,
} from '@/src/store/prompts/prompts.reducers';
import { UISelectors } from '@/src/store/ui/ui.reducers';

import { PromptFolders } from './components/PromptFolders';
import { PromptbarSettings } from './components/PromptbarSettings';
import { Prompts } from './components/Prompts';

import PlusIcon from '../../../public/images/icons/plus-large.svg';
import Sidebar from '../Sidebar';

const PromptActionsBlock = () => {
  const { t } = useTranslation(Translation.PromptBar);
  const dispatch = useAppDispatch();

  return (
    <div className="flex px-2 py-1">
      <button
        className="flex shrink-0 grow cursor-pointer select-none items-center gap-3 rounded px-3 py-2 transition-colors duration-200 hover:bg-accent-primary disabled:cursor-not-allowed"
        onClick={() => {
          dispatch(PromptsActions.createNewPrompt());
          dispatch(PromptsActions.resetSearch());
          dispatch(PromptsActions.setIsEditModalOpen({ isOpen: true }));
        }}
        data-qa="new-prompt"
      >
        <PlusIcon className="text-secondary" width={18} height={18} />
        {t('New prompt')}
      </button>
    </div>
  );
};

const Promptbar = () => {
  const dispatch = useAppDispatch();
  const showPromptbar = useAppSelector(UISelectors.selectShowPromptbar);
  const searchTerm = useAppSelector(PromptsSelectors.selectSearchTerm);
  const myItemsFilters = useAppSelector(PromptsSelectors.selectMyItemsFilters);

  const filteredPrompts = useAppSelector((state) =>
    PromptsSelectors.selectFilteredPrompts(state, myItemsFilters, searchTerm),
  );

  const searchFilters = useAppSelector(PromptsSelectors.selectSearchFilters);

  const handleDrop = useCallback(
    (e: any) => {
      if (e.dataTransfer) {
        const prompt = JSON.parse(e.dataTransfer.getData('prompt'));

        dispatch(
          PromptsActions.updatePrompt({
            promptId: prompt.id,
            values: {
              folderId: e.target.dataset.folderId,
            },
          }),
        );
      }
    },
    [dispatch],
  );

  return (
    <Sidebar<Prompt>
      featureType={FeatureType.Prompt}
      side="right"
      isOpen={showPromptbar}
      itemComponent={<Prompts prompts={filteredPrompts} />}
      actionButtons={<PromptActionsBlock />}
      folderComponent={<PromptFolders />}
      filteredItems={filteredPrompts}
      searchTerm={searchTerm}
      searchFilters={searchFilters}
      handleSearchTerm={(searchTerm: string) =>
        dispatch(PromptsActions.setSearchTerm({ searchTerm }))
      }
      handleSearchFilters={(searchFilters: SearchFilters) =>
        dispatch(PromptsActions.setSearchFilters({ searchFilters }))
      }
      handleDrop={handleDrop}
      footerComponent={<PromptbarSettings />}
    />
  );
};

export default Promptbar;
