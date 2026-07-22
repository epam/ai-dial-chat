import { FC, useCallback } from 'react';
import {
  Controller,
  useFormContext,
  useFormState,
  useWatch,
} from 'react-hook-form';

import { useTranslation } from '@/src/hooks/useTranslation';

import { isEntityIdPublic } from '@/src/utils/app/publications';

import { AnyToolset } from '@/src/types/quick-apps';
import { Translation } from '@/src/types/translation';

import { ApplicationSelectors } from '@/src/store/application/application.selectors';
import { useAppSelector } from '@/src/store/hooks';
import { SettingsSelectors } from '@/src/store/settings/settings.selectors';

import { PUBLIC_APP_TOOLTIP } from '@/src/constants/applications';
import { MarketplaceI18nKeys } from '@/src/constants/i18n';
import { ToolsetTypes } from '@/src/constants/quick-apps';

import { QuickApp2Form as QuickApp2FormType } from '@/src/components/AppsEditor/form';
import { withLabel } from '@/src/components/Common/Forms/Label';
import { ToggleSwitch } from '@/src/components/Common/ToggleSwitch/ToggleSwitch';

import { Feature } from '@epam/ai-dial-shared';

const ToggleSwitchField = withLabel(ToggleSwitch);

const toggleCodeInterpreterInJson = (
  jsonValue: string,
  withInterpreter: boolean,
): string => {
  const toolSets = JSON.parse(jsonValue) as AnyToolset[];
  const toolsetsWithoutInterpreter = toolSets.filter(
    (toolset) => toolset.type !== ToolsetTypes.CodeInterpreter,
  );

  return JSON.stringify(
    withInterpreter
      ? [
          ...toolsetsWithoutInterpreter,
          {
            template_name: 'py_interpreter',
            type: ToolsetTypes.CodeInterpreter,
          },
        ]
      : toolsetsWithoutInterpreter,
    null,
    2,
  );
};

export const CodeInterpreterField: FC = () => {
  const { t } = useTranslation(Translation.Marketplace);

  const isCodeInterpreterEnabled = useAppSelector((state) =>
    SettingsSelectors.isFeatureEnabled(state, Feature.CodeInterpreter),
  );
  const appDetails = useAppSelector(
    ApplicationSelectors.selectApplicationDetail,
  );

  const { control, setValue } = useFormContext<QuickApp2FormType>();
  const { errors } = useFormState({ control });

  const value = useWatch({
    control,
    name: 'codeInterpreter',
  });
  const isJsonView = useWatch({
    control,
    name: 'isJsonView',
  });
  const agentsAndToolsetsJson = useWatch({
    control,
    name: 'agentsAndToolsetsJson',
  });

  const isAppPublic = !!appDetails && isEntityIdPublic(appDetails);

  const handleValueChange = useCallback(() => {
    setValue('codeInterpreter', !value, {
      shouldDirty: true,
      shouldTouch: true,
    });

    if (isJsonView && !errors.agentsAndToolsetsJson) {
      setValue(
        'agentsAndToolsetsJson',
        toggleCodeInterpreterInJson(agentsAndToolsetsJson, !value),
        { shouldDirty: false },
      );
    }
  }, [
    setValue,
    value,
    isJsonView,
    errors.agentsAndToolsetsJson,
    agentsAndToolsetsJson,
  ]);

  if (!isCodeInterpreterEnabled) return null;

  return (
    <Controller
      name="codeInterpreter"
      control={control}
      render={({ field }) => (
        <ToggleSwitchField
          id="code-interpreter"
          label={t(MarketplaceI18nKeys.CodeInterpreter)}
          info={t(MarketplaceI18nKeys.CodeInterpreterInfo)}
          isOn={field.value}
          handleSwitch={handleValueChange}
          switchOnText={t(MarketplaceI18nKeys.OnToggle)}
          switchOFFText={t(MarketplaceI18nKeys.OffToggle)}
          additionalText={t(MarketplaceI18nKeys.UseToExecuteCustomPythonCode)}
          className="mt-1 flex w-fit items-center gap-2"
          disabled={isAppPublic}
          tooltip={isAppPublic ? PUBLIC_APP_TOOLTIP : ''}
        />
      )}
    />
  );
};
