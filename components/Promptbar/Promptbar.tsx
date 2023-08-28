import { useContext, useEffect } from 'react';
import { toast } from 'react-hot-toast';

import { useTranslation } from 'next-i18next';

import { useCreateReducer } from '@/hooks/useCreateReducer';

import { exportPrompts, importPrompts } from '@/utils/app/importExport';
import { savePrompts } from '@/utils/app/prompts';

import { PromptsHistory } from '@/types/export';
import { FolderInterface } from '@/types/folder';
import { OpenAIEntityModels } from '@/types/openai';
import { Prompt } from '@/types/prompt';

import { useAppSelector } from '@/store/hooks';
import { selectDefaultModelId } from '@/store/models/models.reducers';
import { uiSelectors } from '@/store/ui-store/ui.reducers';

import HomeContext from '@/pages/api/home/home.context';

import { PromptFolders } from './components/PromptFolders';
import { PromptbarSettings } from './components/PromptbarSettings';
import { Prompts } from './components/Prompts';

import PlusIcon from '../../public/images/icons/plus-large.svg';
import Sidebar from '../Sidebar';
import PromptbarContext from './PromptBar.context';
import { PromptbarInitialState, initialState } from './Promptbar.state';

import { errorsMessages } from '@/constants/errors';
import { v4 as uuidv4 } from 'uuid';

const Promptbar = () => {
  const { t } = useTranslation('promptbar');

  const promptBarContextValue = useCreateReducer<PromptbarInitialState>({
    initialState,
  });

  const {
    state: { prompts, folders },
    dispatch: homeDispatch,
  } = useContext(HomeContext);
  const defaultModelId = useAppSelector(selectDefaultModelId);
  const showPromptbar = useAppSelector(uiSelectors.selectShowPromptbar);

  const {
    state: { searchTerm, filteredPrompts },
    dispatch: promptDispatch,
  } = promptBarContextValue;

  const promptFolders = folders.filter(({ type }) => type === 'prompt');

  const handleCreatePrompt = () => {
    if (defaultModelId) {
      const newPrompt: Prompt = {
        id: uuidv4(),
        name: `Prompt ${prompts.length + 1}`,
        description: '',
        content: '',
        model: OpenAIEntityModels[defaultModelId],
        folderId: null,
      };

      const updatedPrompts = [...prompts, newPrompt];

      homeDispatch({ field: 'prompts', value: updatedPrompts });

      savePrompts(updatedPrompts);
    }
  };

  const handleDeletePrompt = (prompt: Prompt) => {
    const updatedPrompts = prompts.filter((p) => p.id !== prompt.id);

    homeDispatch({ field: 'prompts', value: updatedPrompts });
    savePrompts(updatedPrompts);
  };

  const handleClearAllPrompts = () => {
    const emptyPromptsStringified = JSON.stringify([]);
    homeDispatch({ field: 'prompts', value: [] });
    localStorage.setItem('prompts', emptyPromptsStringified);

    const folders = localStorage.getItem('folders');

    if (folders) {
      const parsedFolders: FolderInterface[] = JSON.parse(folders);

      const filteredFolders = parsedFolders.filter(
        ({ type }) => type !== 'prompt',
      );
      const filteredFoldersStringified = JSON.stringify(filteredFolders);
      homeDispatch({ field: 'folders', value: filteredFolders });
      localStorage.setItem('folders', filteredFoldersStringified);
    }
  };

  const handleUpdatePrompt = (prompt: Prompt) => {
    const updatedPrompts = prompts.map((p) => {
      if (p.id === prompt.id) {
        return prompt;
      }

      return p;
    });
    homeDispatch({ field: 'prompts', value: updatedPrompts });

    savePrompts(updatedPrompts);
  };

  const handleDrop = (e: any) => {
    if (e.dataTransfer) {
      const prompt = JSON.parse(e.dataTransfer.getData('prompt'));

      const updatedPrompt = {
        ...prompt,
        folderId: e.target.dataset.folderId,
      };

      handleUpdatePrompt(updatedPrompt);
    }
  };

  const handleExportPrompts = () => {
    exportPrompts();
  };

  const handleImportPrompts = (promptsJSON: PromptsHistory) => {
    const { prompts, folders, isError } = importPrompts(promptsJSON);

    if (isError) {
      toast.error(t(errorsMessages.unsupportedDataFormat));
    } else {
      homeDispatch({ field: 'prompts', value: prompts });
      homeDispatch({ field: 'folders', value: folders });
    }
  };

  useEffect(() => {
    if (searchTerm) {
      promptDispatch({
        field: 'filteredPrompts',
        value: prompts.filter((prompt) => {
          const searchable =
            prompt.name.toLowerCase() +
            ' ' +
            prompt.description.toLowerCase() +
            ' ' +
            prompt.content.toLowerCase();
          return searchable.includes(searchTerm.toLowerCase());
        }),
      });
    } else {
      promptDispatch({ field: 'filteredPrompts', value: prompts });
    }
  }, [searchTerm, prompts]);

  const actionsBlock = (
    <button
      className="flex shrink-0 cursor-pointer select-none items-center gap-3 p-5 transition-colors duration-200 hover:bg-violet/15 disabled:cursor-not-allowed"
      onClick={() => {
        handleCreatePrompt();
        promptDispatch({ field: 'searchTerm', value: '' });
      }}
    >
      <PlusIcon className="text-gray-500" width={18} height={18} />
      {t('New prompt')}
    </button>
  );

  return (
    <PromptbarContext.Provider
      value={{
        ...promptBarContextValue,
        handleCreatePrompt,
        handleDeletePrompt,
        handleUpdatePrompt,
        handleExportPrompts,
        handleImportPrompts,
        handleClearAllPrompts,
      }}
    >
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
        folders={promptFolders}
        items={prompts}
        filteredItems={filteredPrompts}
        searchTerm={searchTerm}
        handleSearchTerm={(searchTerm: string) =>
          promptDispatch({ field: 'searchTerm', value: searchTerm })
        }
        handleDrop={handleDrop}
        footerComponent={<PromptbarSettings allPrompts={prompts} />}
      />
    </PromptbarContext.Provider>
  );
};

export default Promptbar;
