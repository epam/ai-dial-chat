import { DragEvent, useCallback } from 'react';

import { useTranslation } from 'next-i18next';

import { isEntityNameOnSameLevelUnique } from '@/src/utils/app/common';
import { getPromptRootId } from '@/src/utils/app/id';
import { MoveType } from '@/src/utils/app/move';
import { regeneratePromptId } from '@/src/utils/app/prompts';

import { FeatureType } from '@/src/types/common';
import { Prompt, PromptInfo } from '@/src/types/prompt';
import { SearchFilters } from '@/src/types/search';
import { Translation } from '@/src/types/translation';

import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import {
  PromptsActions,
  PromptsSelectors,
} from '@/src/store/prompts/prompts.reducers';
import { UIActions, UISelectors } from '@/src/store/ui/ui.reducers';

import { PromptFolders } from './components/PromptFolders';
import { PromptModal } from './components/PromptModal';
import { PromptbarSettings } from './components/PromptbarSettings';
import { Prompts } from './components/Prompts';

import PlusIcon from '../../../public/images/icons/plus-large.svg';
import Tooltip from '../Common/Tooltip';
import Sidebar from '../Sidebar';

const PromptActionsBlock = () => {
  const { t } = useTranslation(Translation.PromptBar);
  const dispatch = useAppDispatch();

  const isNewPromptCreating = useAppSelector(
    PromptsSelectors.selectIsNewPromptCreating,
  );

  const { showModal, isModalPreviewMode } = useAppSelector(
    PromptsSelectors.selectIsEditModalOpen,
  );

  const handleUpdate = useCallback(
    (prompt: Prompt) => {
      isNewPromptCreating
        ? dispatch(PromptsActions.createNewPrompt(regeneratePromptId(prompt)))
        : dispatch(
            PromptsActions.updatePrompt({
              id: prompt.id,
              values: {
                name: prompt.name,
                description: prompt.description,
                content: prompt.content,
                isShared: prompt.isShared,
              },
            }),
          );
      dispatch(PromptsActions.resetSearch());
    },
    [dispatch, isNewPromptCreating],
  );

  const handleClose = useCallback(() => {
    dispatch(PromptsActions.setIsEditModalOpen({ isOpen: false }));
    dispatch(PromptsActions.setSelectedPrompt({ promptId: undefined }));
  }, [dispatch]);

  return (
    <div className="flex px-2 py-1">
      <button
        className="flex shrink-0 grow cursor-pointer select-none items-center gap-3 rounded px-3 py-[5px] transition-colors duration-200 hover:bg-accent-primary-alpha disabled:cursor-not-allowed hover:disabled:bg-transparent"
        onClick={() => {
          dispatch(PromptsActions.setIsNewPromptCreating(true));
          dispatch(PromptsActions.resetSearch());
          dispatch(PromptsActions.setIsEditModalOpen({ isOpen: true }));
          dispatch(PromptsActions.resetChosenPrompts());
        }}
        disabled={isNewPromptCreating}
        data-qa="new-entity"
      >
        <Tooltip tooltip={t('New prompt')}>
          <PlusIcon className="text-secondary" width={24} height={24} />
        </Tooltip>
        {t('New prompt')}
      </button>
      {showModal && !isModalPreviewMode && (
        <PromptModal
          isOpen
          onClose={handleClose}
          onUpdatePrompt={handleUpdate}
        />
      )}
    </div>
  );
};

const Promptbar = () => {
  const { t } = useTranslation(Translation.PromptBar);

  const dispatch = useAppDispatch();
  const showPromptbar = useAppSelector(UISelectors.selectShowPromptbar);
  const allPrompts = useAppSelector(PromptsSelectors.selectPrompts);
  const searchTerm = useAppSelector(PromptsSelectors.selectSearchTerm);
  const myItemsFilters = useAppSelector(PromptsSelectors.selectMyItemsFilters);
  const areEntitiesUploaded = useAppSelector(
    PromptsSelectors.arePromptsUploaded,
  );

  const filteredPrompts = useAppSelector((state) =>
    PromptsSelectors.selectFilteredPrompts(state, myItemsFilters, searchTerm),
  );
  const filteredFolders = useAppSelector((state) =>
    PromptsSelectors.selectFilteredFolders(state, myItemsFilters, searchTerm),
  );

  const searchFilters = useAppSelector(PromptsSelectors.selectSearchFilters);

  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      if (e.dataTransfer) {
        const promptData = e.dataTransfer.getData(MoveType.Prompt);
        const folderId = getPromptRootId();

        if (promptData) {
          const prompt = JSON.parse(promptData);

          if (
            !isEntityNameOnSameLevelUnique(
              prompt.name,
              { ...prompt, folderId },
              allPrompts,
            )
          ) {
            dispatch(
              UIActions.showErrorToast(
                t('Prompt with name "{{name}}" already exists at the root.', {
                  ns: 'prompt',
                  name: prompt.name,
                }),
              ),
            );

            return;
          }

          dispatch(
            PromptsActions.updatePrompt({
              id: prompt.id,
              values: { folderId },
            }),
          );
        }
      }
    },
    [allPrompts, dispatch, t],
  );

  const handleSearchTerm = useCallback(
    (searchTerm: string) => {
      dispatch(PromptsActions.setSearchTerm({ searchTerm }));
      dispatch(PromptsActions.resetChosenPrompts());
    },
    [dispatch],
  );

  const handleSearchFilters = useCallback(
    (searchFilters: SearchFilters) => {
      dispatch(PromptsActions.setSearchFilters({ searchFilters }));
      dispatch(PromptsActions.resetChosenPrompts());
    },
    [dispatch],
  );

  return (
    <Sidebar<PromptInfo>
      featureType={FeatureType.Prompt}
      side="right"
      isOpen={showPromptbar}
      itemComponent={<Prompts prompts={filteredPrompts} />}
      actionButtons={<PromptActionsBlock />}
      folderComponent={<PromptFolders />}
      filteredItems={filteredPrompts}
      filteredFolders={filteredFolders}
      searchTerm={searchTerm}
      searchFilters={searchFilters}
      handleSearchTerm={handleSearchTerm}
      handleSearchFilters={handleSearchFilters}
      handleDrop={handleDrop}
      footerComponent={<PromptbarSettings />}
      areEntitiesUploaded={areEntitiesUploaded}
    />
  );
};

export default Promptbar;
