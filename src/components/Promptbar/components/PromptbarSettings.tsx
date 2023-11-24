import {
  IconFileArrowLeft,
  IconFileArrowRight,
  IconTrashX,
} from '@tabler/icons-react';
import { FC, useState } from 'react';

import { useTranslation } from 'next-i18next';

import { HighlightColor } from '@/src/types/common';
import { Prompt } from '@/src/types/prompt';

import { useAppDispatch } from '@/src/store/hooks';
import { PromptsActions } from '@/src/store/prompts/prompts.reducers';

import { ConfirmDialog } from '@/src/components/Common/ConfirmDialog';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/src/components/Common/Tooltip';
import { Import } from '@/src/components/Settings/Import';

import FolderPlus from '../../../../public/images/icons/folder-plus.svg';

interface PromptbarSettingsProps {
  allPrompts: Prompt[];
}
export const PromptbarSettings: FC<PromptbarSettingsProps> = ({
  allPrompts,
}) => {
  const { t } = useTranslation('promptbar');
  const dispatch = useAppDispatch();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="flex items-start gap-2 p-2 text-gray-500">
      {allPrompts.length > 0 ? (
        <Tooltip isTriggerClickable={true}>
          <TooltipTrigger>
            <div
              className="flex h-[34px] w-[34px] cursor-pointer items-center justify-center rounded hover:bg-violet/15 hover:text-violet"
              onClick={() => {
                setIsOpen(true);
              }}
              data-qa="delete-prompts"
            >
              <IconTrashX size={24} strokeWidth="1.5" />
            </div>
          </TooltipTrigger>
          <TooltipContent>{t('Delete all prompts')}</TooltipContent>
        </Tooltip>
      ) : null}

      <Tooltip isTriggerClickable={true}>
        <TooltipTrigger>
          <Import
            highlightColor={HighlightColor.Violet}
            onImport={(promptsJSON) => {
              dispatch(
                PromptsActions.importPrompts({ promptsHistory: promptsJSON }),
              );
            }}
            icon={
              <IconFileArrowLeft
                className="hover:text-violet"
                size={24}
                strokeWidth="1.5"
              />
            }
          />
        </TooltipTrigger>
        <TooltipContent>{t('Import prompts')}</TooltipContent>
      </Tooltip>

      <Tooltip isTriggerClickable={true}>
        <TooltipTrigger>
          <div
            className="flex h-[34px] w-[34px] cursor-pointer items-center justify-center rounded hover:bg-violet/15 hover:text-violet"
            onClick={() => {
              dispatch(PromptsActions.exportPrompts());
            }}
            data-qa="export-prompts"
          >
            <IconFileArrowRight size={24} strokeWidth="1.5" />
          </div>
        </TooltipTrigger>
        <TooltipContent>{t('Export prompts')}</TooltipContent>
      </Tooltip>

      <Tooltip isTriggerClickable={true}>
        <TooltipTrigger>
          <div
            className="flex h-[34px] w-[34px] cursor-pointer items-center justify-center rounded hover:bg-violet/15 hover:text-violet"
            onClick={() => {
              dispatch(PromptsActions.createFolder({ name: t('New folder') }));
            }}
            data-qa="create-prompt-folder"
          >
            <FolderPlus height={24} width={24} />
          </div>
        </TooltipTrigger>
        <TooltipContent>{t('Create new folder')}</TooltipContent>
      </Tooltip>

      <ConfirmDialog
        isOpen={isOpen}
        heading={t('Confirm clearing all prompts')}
        description={
          t('Are you sure that you want to delete all prompts?') || ''
        }
        confirmLabel={t('Clear')}
        cancelLabel={t('Cancel')}
        onClose={(result) => {
          setIsOpen(false);
          if (result) {
            dispatch(PromptsActions.clearPrompts());
          }
        }}
      />
    </div>
  );
};
