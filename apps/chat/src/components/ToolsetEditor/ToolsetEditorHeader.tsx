import { IconCircleCheck, IconCircleDot } from '@tabler/icons-react';
import { useCallback, useMemo } from 'react';

import { useTranslation } from '@/src/hooks/useTranslation';

import { ToolsetEditorSteps, ToolsetModel } from '@/src/types/toolsets';
import { Translation } from '@/src/types/translation';

import { EditorHeader } from '@/src/components/Header/EditorHeader';

const getTabIcon = (
  tab: ToolsetEditorSteps,
  activeTab: ToolsetEditorSteps,
  isEditing?: boolean,
  isDisabled?: boolean,
) => {
  return tab !== activeTab && isEditing ? (
    <IconCircleCheck
      className="text-accent-primary"
      data-qa="selected-step-icon"
      width={24}
      height={24}
    />
  ) : (
    <IconCircleDot
      className={isDisabled ? 'text-secondary' : 'text-accent-primary'}
      data-qa="not-selected-step-icon"
      width={24}
      height={24}
    />
  );
};

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
        Icon: () =>
          getTabIcon(ToolsetEditorSteps.General, currentStep, isEditing, false),
      },
      {
        label: ToolsetEditorSteps.Settings,
        key: ToolsetEditorSteps.Settings,
        disabled: !isEditing,
        Icon: () =>
          getTabIcon(
            ToolsetEditorSteps.Settings,
            currentStep,
            isEditing,
            !isEditing,
          ),
      },
    ],
    [currentStep, isEditing],
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
      onTabClick={handleTabClick}
      title={t(isEditing ? 'Edit toolset' : 'Add toolset')}
      onSave={onSave}
    />
  );
};
