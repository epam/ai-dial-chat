import { useCallback, useMemo } from 'react';

import { useTranslation } from '@/src/hooks/useTranslation';

import { ToolsetEditorSteps, ToolsetModel } from '@/src/types/toolsets';
import { Translation } from '@/src/types/translation';

import { EditorHeader } from '@/src/components/Header/EditorHeader';

interface ToolsetEditorHeaderProps {
  currentToolset?: ToolsetModel;
  currentStep: ToolsetEditorSteps;
  onTabClick: (tab: ToolsetEditorSteps) => void;
  onSave: () => void;
}

export const ToolsetEditorHeader = ({
  currentToolset,
  currentStep,
  onTabClick,
  onSave,
}: ToolsetEditorHeaderProps) => {
  const { t } = useTranslation(Translation.Chat);

  const isEditing = !!currentToolset;

  const tabs = useMemo(
    () => [
      {
        label: ToolsetEditorSteps.General,
        key: ToolsetEditorSteps.General,
        disabled: false,
      },
      {
        label: ToolsetEditorSteps.Settings,
        key: ToolsetEditorSteps.Settings,
        disabled: !isEditing,
      },
    ],
    [isEditing],
  );

  const handleTabClick = useCallback(
    (tab: { key: ToolsetEditorSteps; disabled: boolean }) => {
      if (tab.disabled) return;
      onTabClick(tab.key);
    },
    [onTabClick],
  );

  return (
    <EditorHeader
      tabs={tabs}
      activeTab={currentStep}
      isEditing={isEditing}
      onTabClick={handleTabClick}
      title={t(isEditing ? 'Edit toolset' : 'Add toolset')}
      saveLabel={isEditing ? 'Save and exit' : 'Exit'}
      onSave={onSave}
    />
  );
};
