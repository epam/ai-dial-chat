import React, { FormEvent, useCallback, useMemo } from 'react';
import { Controller, useFormContext, useFormState } from 'react-hook-form';

import { useScreenState } from '@/src/hooks/useScreenState';
import { useTranslation } from '@/src/hooks/useTranslation';

import { topicToOption } from '@/src/utils/app/application';
import { getLastPathSegment } from '@/src/utils/app/common';
import { preventEnterDown } from '@/src/utils/app/forms';
import { isToolsetSignedIn } from '@/src/utils/app/toolsets';

import { ScreenState } from '@/src/types/common';
import { ToolsetModel } from '@/src/types/toolsets';
import { Translation } from '@/src/types/translation';

import { FilesSelectors } from '@/src/store/files/files.selectors';
import { useAppSelector } from '@/src/store/hooks';
import { SettingsSelectors } from '@/src/store/settings/settings.selectors';
import { ToolsetSelectors } from '@/src/store/toolset/toolset.selectors';

import { IMAGE_TYPES } from '@/src/constants/chat';
import { BYTES_IN_KB } from '@/src/constants/file';
import { CommonI18nKeys } from '@/src/constants/i18n';
import { DEFAULT_VERSION } from '@/src/constants/publication';
import { PUBLIC_TOOLSET_TOOLTIP } from '@/src/constants/toolsets';

import { DropdownSelector } from '@/src/components/Common/DropdownSelector';
import { Field } from '@/src/components/Common/Forms/Field';
import { withErrorMessage } from '@/src/components/Common/Forms/FieldErrorMessage';
import { FieldTextArea } from '@/src/components/Common/Forms/FieldTextArea';
import { withLabel } from '@/src/components/Common/Forms/Label';
import { CustomLogoSelect } from '@/src/components/Settings/CustomLogoSelect';
import { ToolsetEditorForm } from '@/src/components/ToolsetEditor/form';

import { DialPrimaryButton } from '@epam/ai-dial-ui-kit';

const LogoSelector = withErrorMessage(withLabel(CustomLogoSelect));
const TopicsSelector = withLabel(DropdownSelector);

interface GeneralFormProps {
  onNextClick: (e: React.FormEvent<HTMLFormElement>) => void;
  toolset: ToolsetModel | undefined;
  isToolsetPublic: boolean;
}

export const GeneralForm = ({
  onNextClick,
  toolset,
  isToolsetPublic,
}: GeneralFormProps) => {
  const { t } = useTranslation(Translation.Common);

  const topics = useAppSelector(SettingsSelectors.selectTopics);
  const files = useAppSelector(FilesSelectors.selectFiles);
  const isToolsetDetailsLoading = useAppSelector(
    ToolsetSelectors.selectIsToolsetDetailsLoading,
  );

  const screenState = useScreenState();
  const isMobileView = screenState === ScreenState.SM;
  const isEditing = !!toolset;
  const isLoggedIn = toolset && isToolsetSignedIn(toolset);

  const { register, control } = useFormContext<ToolsetEditorForm>();
  const { errors, isValid } = useFormState<ToolsetEditorForm>({ control });

  const topicOptions = useMemo(() => topics.map(topicToOption), [topics]);

  const disabledReason = useMemo(() => {
    if (isToolsetPublic) return PUBLIC_TOOLSET_TOOLTIP;
    if (isLoggedIn) return t(CommonI18nKeys.LogOutBeforeEditingToolset);

    return undefined;
  }, [isLoggedIn, isToolsetPublic, t]);

  const getLogoId = useCallback(
    (filesIds: string[]) => files.find((f) => f.id === filesIds[0])?.id,
    [files],
  );

  const formatVersion = useCallback((e: FormEvent<HTMLInputElement>) => {
    const data = (e.nativeEvent as InputEvent).data;
    if (data && /[^0-9.]/.test(data)) e.preventDefault();
  }, []);

  return (
    <form
      onSubmit={onNextClick}
      className="flex size-full flex-col overflow-hidden bg-layer-2"
      data-qa="entity-general-form"
      onKeyDown={preventEnterDown}
    >
      <div className="grow space-y-4 divide-tertiary overflow-y-auto px-3 py-4 md:px-5 xl:py-5">
        <Field
          {...register('name')}
          label={t(CommonI18nKeys.Name)}
          mandatory
          placeholder={t(CommonI18nKeys.TypeName)}
          id="name"
          disabled={!!disabledReason}
          error={errors.name?.message}
          tooltip={disabledReason}
        />
        <Field
          {...register('version')}
          label={t(CommonI18nKeys.Version)}
          onBeforeInput={formatVersion}
          mandatory
          placeholder={DEFAULT_VERSION}
          id="version"
          disabled={!!disabledReason}
          tooltip={disabledReason}
          error={errors.version?.message}
          name="version"
        />
        <Controller
          name="iconUrl"
          control={control}
          render={({ field }) => (
            <LogoSelector
              id="icon"
              label={t(CommonI18nKeys.Icon)}
              localLogo={getLastPathSegment(field.value)}
              onLogoSelect={(v) => field.onChange(getLogoId(v))}
              onDeleteLocalLogoHandler={() => field.onChange('')}
              customPlaceholder={t(CommonI18nKeys.NoIcon)}
              className="max-w-full"
              fileManagerModalTitle="Select toolset icon"
              allowedTypes={IMAGE_TYPES}
              error={errors.iconUrl?.message}
              disabled={isToolsetPublic}
              maxSelectableFileSize={100 * BYTES_IN_KB}
              tooltip={isToolsetPublic ? PUBLIC_TOOLSET_TOOLTIP : undefined}
            />
          )}
        />
        <FieldTextArea
          {...register('description')}
          label={t(CommonI18nKeys.Description)}
          placeholder={t(CommonI18nKeys.ToolsetDescription)}
          info={t(CommonI18nKeys.DescriptionInfo)}
          rows={3}
          className="resize-none"
          id="description"
          disabled={isToolsetPublic}
          tooltip={isToolsetPublic ? PUBLIC_TOOLSET_TOOLTIP : undefined}
        />
        <Controller
          name="topics"
          control={control}
          render={({ field }) => (
            <TopicsSelector
              label={t(CommonI18nKeys.Topics)}
              value={field.value?.map(topicToOption)}
              options={topicOptions}
              placeholder={t(CommonI18nKeys.SelectOneOrMoreTopics)}
              onChange={(v) => field.onChange(v.map((o) => o.value))}
              id="topics-dropdown"
              isSearchable={!isMobileView}
              isMulti
              isClearable
              menuPlacement={isMobileView ? 'top' : 'auto'}
              isDisabled={isToolsetPublic}
              tooltip={isToolsetPublic ? PUBLIC_TOOLSET_TOOLTIP : undefined}
            />
          )}
        />
      </div>
      <div className="mt-auto flex justify-end gap-2 border-t border-tertiary px-3 py-4 md:px-5 xl:px-6">
        <DialPrimaryButton
          data-qa="save-entity-general-info"
          type="submit"
          disabled={(!isValid && !isEditing) || isToolsetDetailsLoading}
          label={t(CommonI18nKeys.Next)}
          tooltipProps={{
            tooltip: t(CommonI18nKeys.FillInAllRequiredFields),
            hideTooltip: isValid || isEditing,
          }}
        />
      </div>
    </form>
  );
};
