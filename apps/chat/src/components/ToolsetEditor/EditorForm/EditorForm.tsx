import { useMemo } from 'react';

import { useRouter } from 'next/router';

import { isEntityIdPublic } from '@/src/utils/app/publications';

import { ToolsetEditorSteps } from '@/src/types/toolsets';

import { useAppSelector } from '@/src/store/hooks';
import { ToolsetSelectors } from '@/src/store/selectors';

import { ToolsetEditorQuery } from '@/src/constants/toolsets';

import { GeneralForm } from '@/src/components/ToolsetEditor/EditorForm/GeneralForm';
import { SettingsForm } from '@/src/components/ToolsetEditor/EditorForm/SettingsForm';

import isString from 'lodash-es/isString';

interface EditorFormProps {
  onNextClick: (e: React.FormEvent<HTMLFormElement>) => void;
  currentStep: ToolsetEditorSteps;
}

export const EditorForm = ({ onNextClick, currentStep }: EditorFormProps) => {
  const router = useRouter();
  const { [ToolsetEditorQuery.Id]: id } = router.query;
  const toolsetsMap = useAppSelector(ToolsetSelectors.selectToolsetsMap);
  const currentToolset = useMemo(
    () => (isString(id) ? toolsetsMap[id] : undefined),
    [id, toolsetsMap],
  );
  const isToolsetPublic = currentToolset
    ? isEntityIdPublic(currentToolset)
    : false;

  switch (currentStep) {
    case ToolsetEditorSteps.General:
      return (
        <GeneralForm
          onNextClick={onNextClick}
          isToolsetPublic={isToolsetPublic}
          toolset={currentToolset}
        />
      );
    case ToolsetEditorSteps.Settings:
      return <SettingsForm isToolsetPublic={isToolsetPublic} />;
    default:
      return null;
  }
};
