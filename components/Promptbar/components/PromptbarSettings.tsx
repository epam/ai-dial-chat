import { IconFileExport } from '@tabler/icons-react';
import { FC, useContext } from 'react';
import { useTranslation } from 'react-i18next';

import { Prompt } from '@/types/prompt';

import { ClearAllElements } from '@/components/Common/ClearAllElements';
import { Import } from '@/components/Settings/Import';
import { SidebarButton } from '@/components/Sidebar/SidebarButton';

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

  return (
    <div className="flex flex-col items-center space-y-1 border-t border-white/20 pt-1 text-sm">
      {allPrompts.length > 0 ? (
        <ClearAllElements
          onClearAll={handleClearAllPrompts}
          translation="prompts"
          elementsType="prompts"
        />
      ) : null}

      <Import onImport={handleImportPrompts} text={t('Import prompts')} />

      <SidebarButton
        text={t('Export prompts')}
        icon={<IconFileExport size={18} />}
        onClick={handleExportPrompts}
      />
    </div>
  );
};
