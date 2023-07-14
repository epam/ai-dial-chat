import { IconFolderPlus, IconPlus } from '@tabler/icons-react';
import { useContext, useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { useCreateReducer } from '@/hooks/useCreateReducer';

import { exportPrompts, importPrompts } from '@/utils/app/importExport';
import { savePrompts } from '@/utils/app/prompts';

import { PromptsHistory } from '@/types/export';
import { FolderInterface } from '@/types/folder';
import { OpenAIEntityModels } from '@/types/openai';
import { Prompt } from '@/types/prompt';

import HomeContext from '@/pages/api/home/home.context';

import { PromptFolders } from './components/PromptFolders';
import { PromptbarSettings } from './components/PromptbarSettings';
import { Prompts } from './components/Prompts';

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
    state: { prompts, defaultModelId, showPromptbar, folders },
    dispatch: homeDispatch,
    handleCreateFolder,
  } = useContext(HomeContext);

  const {
    state: { searchTerm, filteredPrompts },
    dispatch: promptDispatch,
  } = promptBarContextValue;

  const promptFolders = folders.filter(({ type }) => type === 'prompt');

  const handleTogglePromptbar = () => {
    homeDispatch({ field: 'showPromptbar', value: !showPromptbar });
    localStorage.setItem('showPromptbar', JSON.stringify(!showPromptbar));
  };

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

      e.target.style.background = 'none';
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
    <div className="flex items-center gap-2">
      <button
        className={`disabled:cursor-not-allowed text-sidebar flex grow flex-shrink-0 cursor-pointer select-none items-center gap-3 rounded-md border border-white/20 p-3 text-white transition-colors duration-200 hover:bg-gray-500/10`}
        onClick={() => {
          handleCreatePrompt();
          promptDispatch({ field: 'searchTerm', value: '' });
        }}
      >
        <IconPlus size={16} />
        {t('New prompt')}
      </button>

      <button
        className="flex flex-shrink-0 h-full cursor-pointer items-center gap-3 rounded-md border border-white/20 p-3 text-sm text-white transition-colors duration-200 hover:bg-gray-500/10"
        onClick={() => handleCreateFolder(t('New folder'), 'prompt')}
      >
        <IconFolderPlus size={16} />
      </button>
    </div>
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
        items={filteredPrompts}
        searchTerm={searchTerm}
        handleSearchTerm={(searchTerm: string) =>
          promptDispatch({ field: 'searchTerm', value: searchTerm })
        }
        toggleOpen={handleTogglePromptbar}
        handleDrop={handleDrop}
        footerComponent={<PromptbarSettings allPrompts={prompts} />}
      />
    </PromptbarContext.Provider>
  );
};

export default Promptbar;
