import {
  IconFileArrowLeft,
  IconFileArrowRight,
  IconTrashX,
} from '@tabler/icons-react';
import { FC, useContext, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Prompt } from '@/types/prompt';

import HomeContext from '@/pages/api/home/home.context';

import { ConfirmDialog } from '@/components/Common/ConfirmDialog';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/Common/Tooltip';
import { Import } from '@/components/Settings/Import';

import FolderPlus from '../../../public/images/icons/folder-plus.svg';
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
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="flex items-start gap-1 p-2 text-gray-500">
      {allPrompts.length > 0 ? (
        <Tooltip isTriggerClickable={true}>
          <TooltipTrigger>
            <div
              className="flex h-[38px] w-[38px] cursor-pointer items-center justify-center rounded hover:bg-violet/15 hover:text-violet md:h-[42px] md:w-[42px]"
              onClick={() => {
                setIsOpen(true);
              }}
            >
              <IconTrashX size={24} />
            </div>
          </TooltipTrigger>
          <TooltipContent>{t('Delete all prompts')}</TooltipContent>
        </Tooltip>
      ) : null}

      <Tooltip isTriggerClickable={true}>
        <TooltipTrigger>
          <Import
            highlightColor="violet"
            onImport={handleImportPrompts}
            icon={<IconFileArrowLeft className="hover:text-violet" size={24} />}
          />
        </TooltipTrigger>
        <TooltipContent>{t('Import prompts')}</TooltipContent>
      </Tooltip>

      <Tooltip isTriggerClickable={true}>
        <TooltipTrigger>
          <div
            className="flex h-[38px] w-[38px] cursor-pointer items-center justify-center rounded hover:bg-violet/15 hover:text-violet md:h-[42px] md:w-[42px]"
            onClick={() => handleExportPrompts()}
          >
            <IconFileArrowRight size={24} />
          </div>
        </TooltipTrigger>
        <TooltipContent>{t('Export prompts')}</TooltipContent>
      </Tooltip>

      <Tooltip isTriggerClickable={true}>
        <TooltipTrigger>
          <div
            className="flex h-[38px] w-[38px] cursor-pointer items-center justify-center rounded hover:bg-violet/15 hover:text-violet md:h-[42px] md:w-[42px]"
            onClick={() => handleCreateFolder(t('New folder'), 'prompt')}
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
            handleClearAllPrompts();
          }
        }}
      />
    </div>
  );
};
