import { useContext, useState } from 'react';

import { useTranslation } from 'next-i18next';

import { DEFAULT_CONVERSATION_NAME } from '@/utils/app/const';

import HomeContext from '@/pages/api/home/home.context';

import { ConfirmDialog } from '@/components/Common/ConfirmDialog';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/Common/Tooltip';

import FileLeftIcon from '../../../public/images/icons/file-arrow-left.svg';
import FileRightIcon from '../../../public/images/icons/file-arrow-right.svg';
import FolderPlusIcon from '../../../public/images/icons/folder-plus.svg';
import CompareIcon from '../../../public/images/icons/scale-balanced.svg';
import TrashIcon from '../../../public/images/icons/trash.svg';
import { Import } from '../../Settings/Import';
import ChatbarContext from '../Chatbar.context';

export const ChatbarSettings = () => {
  const { t } = useTranslation('sidebar');
  const [isOpen, setIsOpen] = useState(false);

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
        <Tooltip isTriggerClickable={true}>
          <TooltipTrigger>
            <div
              className="flex h-[38px] w-[38px] cursor-pointer items-center justify-center rounded hover:bg-green/15 hover:text-green md:h-[42px] md:w-[42px]"
              onClick={() => {
                setIsOpen(true);
              }}
            >
              <TrashIcon width={24} height={24} />
            </div>
          </TooltipTrigger>
          <TooltipContent>{t('Delete all conversations')}</TooltipContent>
        </Tooltip>
      ) : null}

      <Tooltip isTriggerClickable={true}>
        <TooltipTrigger>
          <Import
            highlightColor="green"
            onImport={handleImportConversations}
            icon={<FileLeftIcon width={24} height={24} />}
          />
        </TooltipTrigger>
        <TooltipContent>{t('Import conversations')}</TooltipContent>
      </Tooltip>

      <Tooltip isTriggerClickable={true}>
        <TooltipTrigger>
          <div
            className="flex h-[38px] w-[38px] cursor-pointer items-center justify-center rounded hover:bg-green/15 hover:text-green md:h-[42px] md:w-[42px]"
            onClick={() => handleExportConversations()}
          >
            <FileRightIcon width={24} height={24} />
          </div>
        </TooltipTrigger>
        <TooltipContent>{t('Export conversations')}</TooltipContent>
      </Tooltip>

      <Tooltip isTriggerClickable={true}>
        <TooltipTrigger>
          <div
            className="flex h-[38px] w-[38px] cursor-pointer items-center justify-center rounded hover:bg-green/15 hover:text-green md:h-[42px] md:w-[42px]"
            onClick={() => handleCreateFolder(t('New folder'), 'chat')}
          >
            <FolderPlusIcon width={24} height={24} />
          </div>
        </TooltipTrigger>
        <TooltipContent>{t('Create new folder')}</TooltipContent>
      </Tooltip>

      <Tooltip isTriggerClickable={true}>
        <TooltipTrigger>
          <div
            className="flex h-[38px] w-[38px] cursor-pointer items-center justify-center rounded hover:bg-green/15 hover:text-green md:h-[42px] md:w-[42px]"
            onClick={() => {
              handleToggleCompare();
            }}
          >
            <CompareIcon width={24} height={24} />
          </div>
        </TooltipTrigger>
        <TooltipContent>{t('Compare chats')}</TooltipContent>
      </Tooltip>

      <ConfirmDialog
        isOpen={isOpen}
        heading={t('Confirm clearing all conversations')}
        description={
          t('Are you sure that you want to delete all conversations?') || ''
        }
        confirmLabel={t('Clear')}
        cancelLabel={t('Cancel')}
        onClose={(result) => {
          setIsOpen(false);
          if (result) {
            handleClearConversations();
          }
        }}
      />
    </div>
  );
};
