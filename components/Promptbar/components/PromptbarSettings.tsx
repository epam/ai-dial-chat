import { FC, useContext } from 'react';
import { useTranslation } from 'react-i18next';

import { Prompt } from '@/types/prompt';

import HomeContext from '@/pages/api/home/home.context';

import { Import } from '@/components/Settings/Import';

import FileRightIcon from '../../../public/images/icons/file-arrow-right.svg';
import FolderPlusIcon from '../../../public/images/icons/folder-plus.svg';
import TrashIcon from '../../../public/images/icons/trash.svg';
import PromptbarContext from '../PromptBar.context';

interface PromptbarSettingsProps {
  allPrompts: Prompt[];
}
export const PromptbarSettings: FC<PromptbarSettingsProps> = ({
  allPrompts,
}) => {
  const { t } = useTranslation('promptbar');
  const { handleExportPrompts, handleImportPrompts, handleClearAllPrompts } =
    useContext(PromptbarContext);
  const { handleCreateFolder } = useContext(HomeContext);
  return (
    <div className="flex items-start gap-1 p-2 text-gray-500">
      {allPrompts.length > 0 ? (
        <div
          className="flex h-[38px] w-[38px] cursor-pointer items-center justify-center"
          onClick={handleClearAllPrompts}
        >
          <TrashIcon width={24} height={24} />
        </div>
      ) : null}

      <Import onImport={handleImportPrompts} />
      <div
        className="flex h-[38px] w-[38px] cursor-pointer items-center justify-center"
        onClick={() => handleExportPrompts()}
      >
        <FileRightIcon width={24} height={24} />
      </div>

      <div
        className="flex h-[38px] w-[38px] cursor-pointer items-center justify-center"
        onClick={() => handleCreateFolder(t('New folder'), 'prompt')}
      >
        <FolderPlusIcon width={24} height={24} />
      </div>
    </div>
  );
};
