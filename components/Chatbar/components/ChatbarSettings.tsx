import { useContext } from 'react';

import { useTranslation } from 'next-i18next';

import { DEFAULT_CONVERSATION_NAME } from '@/utils/app/const';

import HomeContext from '@/pages/api/home/home.context';

import FileLeftIcon from '../../../public/images/icons/file-arrow-left.svg';
import FileRightIcon from '../../../public/images/icons/file-arrow-right.svg';
import FolderPlusIcon from '../../../public/images/icons/folder-plus.svg';
import CompareIcon from '../../../public/images/icons/scale-balanced.svg';
import TrashIcon from '../../../public/images/icons/trash.svg';
import { Import } from '../../Settings/Import';
import ChatbarContext from '../Chatbar.context';

export const ChatbarSettings = () => {
  const { t } = useTranslation('sidebar');

  const {
    state: { conversations },
    dispatch: homeDispatch,
    handleCreateFolder,
    handleNewConversations,
    handleSelectConversations,
  } = useContext(HomeContext);

  const {
    handleClearConversations,
    handleImportConversations,
    handleExportConversations,
  } = useContext(ChatbarContext);

  const handleToggleCompare = () => {
    const newConversations = handleNewConversations(
      DEFAULT_CONVERSATION_NAME,
      2,
    );
    if (!newConversations) {
      return;
    }

    handleSelectConversations(newConversations);
    homeDispatch({
      field: 'isCompareMode',
      value: true,
    });
  };

  return (
    <div className="flex items-start gap-1 p-2 text-gray-500">
      {conversations.length > 0 ? (
        <div
          className="flex h-[38px] w-[38px] cursor-pointer items-center justify-center"
          onClick={handleClearConversations}
        >
          <TrashIcon className="hover:text-green" width={24} height={24} />
        </div>
      ) : null}

      <Import
        onImport={handleImportConversations}
        icon={
          <FileLeftIcon className="hover:text-green" width={24} height={24} />
        }
      />
      <div
        className="flex h-[38px] w-[38px] cursor-pointer items-center justify-center hover:text-green"
        onClick={() => handleExportConversations()}
      >
        <FileRightIcon width={24} height={24} />
      </div>

      <div
        className="flex h-[38px] w-[38px] cursor-pointer items-center justify-center hover:text-green"
        onClick={() => handleCreateFolder(t('New folder'), 'chat')}
      >
        <FolderPlusIcon width={24} height={24} />
      </div>
      <div
        className="flex h-[38px] w-[38px] cursor-pointer items-center justify-center hover:text-green"
        onClick={() => {
          handleToggleCompare();
        }}
      >
        <CompareIcon width={24} height={24} />
      </div>
    </div>
  );
};
