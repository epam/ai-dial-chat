import { useTranslation } from 'next-i18next';

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

const Promptbar = () => {
  const { t } = useTranslation('promptbar');

  const dispatch = useAppDispatch();
  const showPromptbar = useAppSelector(UISelectors.selectShowPromptbar);
  const filteredPrompts = useAppSelector(
    PromptsSelectors.selectSearchedPrompts,
  );
  const promptsFolders = useAppSelector(PromptsSelectors.selectFolders);
  const prompts = useAppSelector(PromptsSelectors.selectPrompts);
  const searchTerm = useAppSelector(PromptsSelectors.selectSearchTerm);

  const handleDrop = (e: any) => {
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
  };

  // const handleExportPrompts = () => {
  //   dispatch(PromptsActions.exportPrompts());
  // };

  // const handleImportPrompts = (promptsJSON: PromptsHistory) => {
  //   dispatch(PromptsActions.importPrompts({ promptsHistory: promptsJSON }));
  // };

  const actionsBlock = (
    <button
      className="flex shrink-0 cursor-pointer select-none items-center gap-3 p-5 transition-colors duration-200 hover:bg-violet/15 disabled:cursor-not-allowed"
      onClick={() => {
        dispatch(PromptsActions.createNewPrompt());
        dispatch(PromptsActions.setSearchTerm({ searchTerm: '' }));
      }}
    >
      <PlusIcon className="text-gray-500" width={18} height={18} />
      {t('New prompt')}
    </button>
  );

  return (
    <Sidebar<Prompt>
      featureType="prompt"
      side={'right'}
      isOpen={showPromptbar}
      itemComponent={
        <Prompts
          prompts={filteredPrompts.filter((prompt) => !prompt.folderId)}
        />
      }
      actionButtons={actionsBlock}
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
