import { useContext } from 'react';

import { useTranslation } from 'next-i18next';

import { DEFAULT_CONVERSATION_NAME } from '@/utils/app/const';

import HomeContext from '@/pages/api/home/home.context';

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
          <TrashIcon width={24} height={24} />
        </div>
      ) : null}

      <Import onImport={handleImportConversations} />
      <div
        className="flex h-[38px] w-[38px] cursor-pointer items-center justify-center"
        onClick={() => handleExportConversations()}
      >
        <FileRightIcon width={24} height={24} />
      </div>

      <div
        className="flex h-[38px] w-[38px] cursor-pointer items-center justify-center"
        onClick={() => handleCreateFolder(t('New folder'), 'chat')}
      >
        <FolderPlusIcon width={24} height={24} />
      </div>
      <div
        className="flex h-[38px] w-[38px] cursor-pointer items-center justify-center"
        onClick={() => {
          handleToggleCompare();
        }}
      >
        <CompareIcon width={24} height={24} />
      </div>
      {/*
      <SidebarButton
        text={t('Export conversations')}
        icon={<IconFileExport size={18} />}
        onClick={() => handleExportConversations()}
      /> */}
      {/* <button
        className="flex h-full shrink-0 cursor-pointer items-center gap-3 rounded-md border border-white/20 p-3 text-sm transition-colors duration-200 hover:bg-gray-500/10 disabled:cursor-not-allowed"
        onClick={handleToggleCompare}
        disabled={!!messageIsStreaming}
      >
        <IconScale size={16} />
      </button>
      <button
        className="flex h-full shrink-0 cursor-pointer items-center gap-3 rounded-md border border-white/20 p-3 text-sm transition-colors duration-200 hover:bg-gray-500/10"
        onClick={() => handleCreateFolder(t('New folder'), 'chat')}
      >
        <IconFolderPlus size={16} />
      </button> */}
    </div>
  );
};
