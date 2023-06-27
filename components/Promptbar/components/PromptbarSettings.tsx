import { IconFileExport } from '@tabler/icons-react';
import { FC, useContext } from 'react';
import { useTranslation } from 'react-i18next';

import { Import } from '@/components/Settings/Import';
import { SidebarButton } from '@/components/Sidebar/SidebarButton';

import PromptbarContext from '../PromptBar.context';

export const PromptbarSettings: FC = () => {
  const { t } = useTranslation('promptbar');
  const { handleExportPrompts, handleImportPrompts } =
    useContext(PromptbarContext);
  return (
    <div className="flex flex-col items-center space-y-1 border-t border-white/20 pt-1 text-sm">
      <Import
        onImport={handleImportPrompts}
        text={t('Import prompts')}
        type="prompts"
      />

      <SidebarButton
        text={t('Export prompts')}
        icon={<IconFileExport size={18} />}
        onClick={handleExportPrompts}
      />
    </div>
  );
};
