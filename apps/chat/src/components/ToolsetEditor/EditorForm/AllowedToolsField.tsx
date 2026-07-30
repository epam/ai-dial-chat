import React, { FC, useCallback, useMemo } from 'react';
import { Controller, useFormContext, useWatch } from 'react-hook-form';

import classNames from 'classnames';

import { useTranslation } from '@/src/hooks/useTranslation';

import { DropdownSelectorOption } from '@/src/types/common';
import { Translation } from '@/src/types/translation';

import { ToolsetActions } from '@/src/store/actions';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { ToolsetSelectors } from '@/src/store/toolset/toolset.selectors';

import { CommonI18nKeys } from '@/src/constants/i18n';
import { PUBLIC_TOOLSET_TOOLTIP } from '@/src/constants/toolsets';

import { CreatableSelect } from '@/src/components/Common/CreatableSelect';
import { withLabel } from '@/src/components/Common/Forms/Label';
import { ToolsetEditorForm } from '@/src/components/ToolsetEditor/form';

import { UploadStatus } from '@epam/ai-dial-shared';
import uniq from 'lodash-es/uniq';

const AllowedToolsSelectField = withLabel(CreatableSelect, true);

const toOption = (value: string): DropdownSelectorOption => ({
  label: value,
  value,
});

interface AllowedToolsFieldProps {
  isToolsetPublic?: boolean;
}

export const AllowedToolsField: FC<AllowedToolsFieldProps> = ({
  isToolsetPublic,
}) => {
  const { t } = useTranslation(Translation.Common);
  const dispatch = useAppDispatch();

  const toolset = useAppSelector(ToolsetSelectors.selectToolsetDetails);
  const allowedTools = useAppSelector(ToolsetSelectors.selectAllowedTools);
  const toolsEndpoint = useAppSelector(
    ToolsetSelectors.selectAllowedToolsEndpoint,
  );
  const allowedToolsStatus = useAppSelector(
    ToolsetSelectors.selectAllowedToolsStatus,
  );

  const isAllowedToolsLoading = allowedToolsStatus === UploadStatus.LOADING;

  const { control } = useFormContext<ToolsetEditorForm>();

  const endpointValue = useWatch({
    control,
    name: 'endpoint',
  });

  const toolsOptions = useMemo(
    () =>
      endpointValue !== toolsEndpoint
        ? []
        : allowedTools.map((tool) => toOption(tool.name)),
    [allowedTools, endpointValue, toolsEndpoint],
  );

  const handleMenuOpen = useCallback(() => {
    if (isAllowedToolsLoading) return;
    if (
      allowedToolsStatus === UploadStatus.UNINITIALIZED ||
      toolsEndpoint !== endpointValue
    ) {
      dispatch(ToolsetActions.getAllowedTools({ id: toolset?.id as string }));
    }
  }, [
    allowedToolsStatus,
    dispatch,
    endpointValue,
    isAllowedToolsLoading,
    toolsEndpoint,
    toolset?.id,
  ]);

  return (
    <Controller
      name="allowedTools"
      control={control}
      render={({ field }) => (
        <AllowedToolsSelectField
          id="allowedTools"
          value={field.value.map(toOption)}
          options={toolsOptions}
          onChange={(value) =>
            field.onChange(
              uniq(value.map((option) => option.value.trim()).filter(Boolean)),
            )
          }
          onFocus={handleMenuOpen}
          placeholder={t(CommonI18nKeys.EnterOneOrMoreTools)}
          isDisabled={isToolsetPublic}
          isLoading={isAllowedToolsLoading}
          tooltip={isToolsetPublic ? PUBLIC_TOOLSET_TOOLTIP : undefined}
          className={classNames(isToolsetPublic && 'hover:border-primary')}
          dataQa="combobox"
          label={t(CommonI18nKeys.AllowedToolsEditorDescription)}
        />
      )}
    />
  );
};
