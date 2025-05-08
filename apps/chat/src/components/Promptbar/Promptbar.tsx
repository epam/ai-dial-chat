import { DragEvent, useCallback, useMemo } from 'react';

import { useTranslation } from '@/src/hooks/useTranslation';

import { isEntityNameOnSameLevelUnique } from '@/src/utils/app/common';
import { getPromptRootId } from '@/src/utils/app/id';
import { MoveType } from '@/src/utils/app/move';

import { FeatureType } from '@/src/types/common';
import { PromptInfo } from '@/src/types/prompt';
import { SearchFilters } from '@/src/types/search';
import { Translation } from '@/src/types/translation';

import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { PromptsActions } from '@/src/store/prompts/prompts.reducers';
import { PromptsSelectors } from '@/src/store/prompts/prompts.selectors';
import { UIActions } from '@/src/store/ui/ui.reducers';
import { UISelectors } from '@/src/store/ui/ui.selectors';

import { RECENT_PROMPTS_SECTION_NAME } from '@/src/constants/sections';

import { PromptFolders } from './components/PromptFolders';
import { PromptbarSettings } from './components/PromptbarSettings';
import { Prompts } from './components/Prompts';

import Sidebar from '../Sidebar';

export const Promptbar = () => {
  const { t } = useTranslation(Translation.PromptBar);

  const dispatch = useAppDispatch();

  const showPromptbar = useAppSelector(UISelectors.selectShowPromptbar);
  const allPrompts = useAppSelector(PromptsSelectors.selectPrompts);
  const searchTerm = useAppSelector(PromptsSelectors.selectSearchTerm);
  const myItemsFilters = useAppSelector(PromptsSelectors.selectMyItemsFilters);
  const areEntitiesUploaded = useAppSelector(
    PromptsSelectors.arePromptsUploaded,
  );

  const collapsedSectionsSelector = useMemo(
    () => UISelectors.selectCollapsedSections(FeatureType.Chat),
    [],
  );

  const collapsedSections = useAppSelector(collapsedSectionsSelector);

  const filteredPromptsSelector = useMemo(
    () => PromptsSelectors.selectFilteredPrompts(myItemsFilters, searchTerm),
    [myItemsFilters, searchTerm],
  );
  const filteredFoldersSelector = useMemo(
    () => PromptsSelectors.selectFilteredFolders(myItemsFilters, searchTerm),
    [myItemsFilters, searchTerm],
  );

  const filteredPrompts = useAppSelector(filteredPromptsSelector);
  const filteredFolders = useAppSelector(filteredFoldersSelector);

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
                  ns: Translation.PromptBar,
                  name: prompt.name,
                }),
              ),
            );

            return;
          }

          dispatch(
            UIActions.setCollapsedSections({
              featureType: FeatureType.Prompt,
              collapsedSections: collapsedSections.filter(
                (section) => section !== RECENT_PROMPTS_SECTION_NAME,
              ),
            }),
          );
          dispatch(
            PromptsActions.updatePrompt({
              id: prompt.id,
              values: { folderId },
            }),
          );
        }
      }
    },
    [allPrompts, collapsedSections, dispatch, t],
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
    <>
      <Sidebar<PromptInfo>
        featureType={FeatureType.Prompt}
        side="right"
        isOpen={showPromptbar}
        itemComponent={<Prompts prompts={filteredPrompts} />}
        folderComponent={<PromptFolders />}
        filteredItems={filteredPrompts}
        filteredFolders={filteredFolders}
        searchTerm={searchTerm}
        searchFilters={searchFilters}
        onSearchTerm={handleSearchTerm}
        onSearchFilters={handleSearchFilters}
        onDrop={handleDrop}
        footerComponent={<PromptbarSettings />}
        areEntitiesUploaded={areEntitiesUploaded}
      />
    </>
  );
};
