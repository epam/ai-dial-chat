import { useCallback } from 'react';

import { useTranslation } from 'next-i18next';

import { FeatureType } from '@/src/types/common';
import { Prompt } from '@/src/types/prompt';

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
  const { t } = useTranslation('promptbar');
  const dispatch = useAppDispatch();

  return (
    <div className="flex px-2 py-1">
      <button
        className="flex shrink-0 grow cursor-pointer select-none items-center gap-3 rounded px-3 py-2 transition-colors duration-200 hover:bg-violet/15 disabled:cursor-not-allowed"
        onClick={() => {
          dispatch(PromptsActions.createNewPrompt());
          dispatch(PromptsActions.setSearchTerm({ searchTerm: '' }));
          dispatch(PromptsActions.setIsEditModalOpen({ isOpen: true }));
        }}
        data-qa="new-prompt"
      >
        <PlusIcon className="text-gray-500" width={18} height={18} />
        {t('New prompt')}
      </button>
    </div>
  );
};

const Promptbar = () => {
  const dispatch = useAppDispatch();
  const showPromptbar = useAppSelector(UISelectors.selectShowPromptbar);
  const filteredPrompts = useAppSelector(
    PromptsSelectors.selectSearchedPrompts,
  );
  const promptsFolders = useAppSelector(PromptsSelectors.selectFolders);
  const prompts = useAppSelector(PromptsSelectors.selectPrompts);
  const searchTerm = useAppSelector(PromptsSelectors.selectSearchTerm);

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
      itemComponent={
        <Prompts
          prompts={filteredPrompts.filter((prompt) => !prompt.folderId)}
        />
      }
      actionButtons={<PromptActionsBlock />}
      folderComponent={<PromptFolders />}
      folders={promptsFolders}
      items={prompts}
      filteredItems={filteredPrompts}
      searchTerm={searchTerm}
      handleSearchTerm={(searchTerm: string) =>
        dispatch(PromptsActions.setSearchTerm({ searchTerm }))
      }
      handleDrop={handleDrop}
      footerComponent={<PromptbarSettings allPrompts={prompts} />}
    />
  );
};

export default Promptbar;
