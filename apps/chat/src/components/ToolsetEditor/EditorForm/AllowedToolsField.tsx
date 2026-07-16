import React, { FC, useCallback, useEffect, useMemo, useRef } from 'react';
import { Controller, useFormContext, useWatch } from 'react-hook-form';

import classNames from 'classnames';

import { useTranslation } from '@/src/hooks/useTranslation';

import { Translation } from '@/src/types/translation';

import { ToolsetActions } from '@/src/store/actions';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { ToolsetSelectors } from '@/src/store/toolset/toolset.selectors';

import { CommonI18nKeys } from '@/src/constants/i18n';
import { PUBLIC_TOOLSET_TOOLTIP } from '@/src/constants/toolsets';

import { withLabel } from '@/src/components/Common/Forms/Label';
import { MultipleComboBox } from '@/src/components/Common/MultipleComboBox';
import { ToolsetEditorForm } from '@/src/components/ToolsetEditor/form';

import { UploadStatus } from '@epam/ai-dial-shared';

const ComboBoxField = withLabel(MultipleComboBox);
interface AllowedToolsFieldProps {
  isToolsetPublic?: boolean;
}

const getComboBoxLabel = (item: unknown): string => item as string;

export const AllowedToolsField: FC<AllowedToolsFieldProps> = ({
  isToolsetPublic,
}) => {
  const { t } = useTranslation(Translation.Common);
  const dispatch = useAppDispatch();

  const selectRef = useRef<HTMLInputElement | null>(null);

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
        : allowedTools.map((tool) => tool.name),
    [allowedTools, endpointValue, toolsEndpoint],
  );

  const isCreatable = allowedToolsStatus === UploadStatus.FAILED;

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

  useEffect(() => {
    const selectInput = selectRef.current;
    selectInput?.addEventListener('focus', handleMenuOpen);

    return () => selectInput?.removeEventListener('focus', handleMenuOpen);
  }, [handleMenuOpen]);

  return (
    <Controller
      name="allowedTools"
      control={control}
      render={({ field }) => (
        <ComboBoxField
          inputRef={selectRef}
          initialSelectedItems={field.value}
          getItemLabel={getComboBoxLabel}
          getItemValue={getComboBoxLabel}
          onChangeSelectedItems={field.onChange}
          placeholder={t(CommonI18nKeys.EnterOneOrMoreTools)}
          id="allowedTools"
          disabled={isToolsetPublic}
          className={classNames(
            'input-form input-invalid peer mx-0 flex items-start py-1 pl-0 md:max-w-full',
            isToolsetPublic && 'hover:border-primary',
          )}
          hasDeleteAll
          isLoading={isAllowedToolsLoading}
          itemHeightClassName="h-[31px]"
          tooltip={isToolsetPublic ? PUBLIC_TOOLSET_TOOLTIP : undefined}
          dataQa="combobox"
          items={isCreatable ? undefined : toolsOptions}
          hideSuggestions={isCreatable}
        />
      )}
    />
  );
};
