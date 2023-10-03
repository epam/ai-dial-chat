import {
  IconFileArrowLeft,
  IconFileArrowRight,
  IconScale,
  IconTrashX,
} from '@tabler/icons-react';
import { useCallback, useState } from 'react';

import { useTranslation } from 'next-i18next';

import {
  ConversationsActions,
  ConversationsSelectors,
} from '@/src/store/conversations/conversations.reducers';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';

import { DEFAULT_CONVERSATION_NAME } from '@/src/constants/default-settings';

import { ConfirmDialog } from '@/src/components/Common/ConfirmDialog';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/src/components/Common/Tooltip';

import FolderPlus from '../../../../public/images/icons/folder-plus.svg';
import { Import } from '../../Settings/Import';

export const ChatbarSettings = () => {
  const { t } = useTranslation('sidebar');
  const [isOpen, setIsOpen] = useState(false);

  const dispatch = useAppDispatch();

  const conversations = useAppSelector(
    ConversationsSelectors.selectConversations,
  );
  const isStreaming = useAppSelector(
    ConversationsSelectors.selectIsConversationsStreaming,
  );

  const handleToggleCompare = useCallback(() => {
    dispatch(
      ConversationsActions.createNewConversations({
        names: [DEFAULT_CONVERSATION_NAME, DEFAULT_CONVERSATION_NAME],
      }),
    );
  }, [dispatch]);

  return (
    <div className="flex items-start gap-1 p-2 text-gray-500">
      {conversations.length > 0 ? (
        <Tooltip isTriggerClickable={true}>
          <TooltipTrigger>
            <button
              className="flex h-[38px] w-[38px] cursor-pointer items-center justify-center rounded hover:bg-green/15 hover:text-green md:h-[42px] md:w-[42px]"
              onClick={() => {
                setIsOpen(true);
              }}
              data-qa="delete-conversations"
            >
              <IconTrashX size={24} strokeWidth="1.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent>{t('Delete all conversations')}</TooltipContent>
        </Tooltip>
      ) : null}

      <Tooltip isTriggerClickable={true}>
        <TooltipTrigger>
          <Import
            highlightColor="green"
            onImport={(importJSON) => {
              dispatch(
                ConversationsActions.importConversations({ data: importJSON }),
              );
            }}
            icon={<IconFileArrowLeft size={24} strokeWidth="1.5" />}
          />
        </TooltipTrigger>
        <TooltipContent>{t('Import conversations')}</TooltipContent>
      </Tooltip>

      <Tooltip isTriggerClickable={true}>
        <TooltipTrigger>
          <button
            className="flex h-[38px] w-[38px] cursor-pointer items-center justify-center rounded hover:bg-green/15 hover:text-green md:h-[42px] md:w-[42px]"
            onClick={() => {
              dispatch(ConversationsActions.exportConversations());
            }}
          >
            <IconFileArrowRight size={24} strokeWidth="1.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent>{t('Export conversations')}</TooltipContent>
      </Tooltip>

      <Tooltip isTriggerClickable={true}>
        <TooltipTrigger>
          <button
            className="flex h-[38px] w-[38px] cursor-pointer items-center justify-center rounded hover:bg-green/15 hover:text-green md:h-[42px] md:w-[42px]"
            onClick={() =>
              dispatch(
                ConversationsActions.createFolder({ name: t('New folder') }),
              )
            }
            data-qa="create-folder"
          >
            <FolderPlus height={24} width={24} />
          </button>
        </TooltipTrigger>
        <TooltipContent>{t('Create new folder')}</TooltipContent>
      </Tooltip>

      <Tooltip isTriggerClickable={true}>
        <TooltipTrigger>
          <button
            className="flex h-[38px] w-[38px] cursor-pointer items-center justify-center rounded hover:bg-green/15 hover:text-green disabled:cursor-not-allowed md:h-[42px] md:w-[42px]"
            onClick={() => {
              handleToggleCompare();
            }}
            disabled={isStreaming}
            data-qa="compare"
          >
            <IconScale size={24} strokeWidth="1.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent>{t('Compare mode')}</TooltipContent>
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
            dispatch(ConversationsActions.clearConversations());
          }
        }}
      />
    </div>
  );
};
