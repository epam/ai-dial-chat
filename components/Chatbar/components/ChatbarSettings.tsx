import { IconFileExport } from '@tabler/icons-react';
import { useContext } from 'react';

import { useTranslation } from 'next-i18next';

import HomeContext from '@/pages/api/home/home.context';

import { ClearAllElements } from '../../Common/ClearAllElements';
import { Import } from '../../Settings/Import';
import { SidebarButton } from '../../Sidebar/SidebarButton';
import ChatbarContext from '../Chatbar.context';

export const ChatbarSettings = () => {
  const { t } = useTranslation('sidebar');

  const {
    state: { conversations },
  } = useContext(HomeContext);

  const {
    handleClearConversations,
    handleImportConversations,
    handleExportConversations,
  } = useContext(ChatbarContext);

  return (
    <div className="flex flex-col items-center space-y-1 border-t border-white/20 pt-1 text-sm">
      {conversations.length > 0 ? (
        <ClearAllElements
          onClearAll={handleClearConversations}
          translation="sidebar"
          elementsType="conversations"
        />
      ) : null}

      <Import
        onImport={handleImportConversations}
        text={t('Import conversations')}
      />

      <SidebarButton
        text={t('Export conversations')}
        icon={<IconFileExport size={18} />}
        onClick={() => handleExportConversations()}
      />
    </div>
  );
};
