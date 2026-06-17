import React, { FormEvent, useCallback, useMemo } from 'react';
import { Controller, useFormContext, useFormState } from 'react-hook-form';

import { useRouter } from 'next/router';

import { useScreenState } from '@/src/hooks/useScreenState';
import { useTopicTranslation } from '@/src/hooks/useTopicTranslation';
import { useTranslation } from '@/src/hooks/useTranslation';

import { getSharedTooltip, topicToOption } from '@/src/utils/app/application';
import { getLastPathSegment } from '@/src/utils/app/common';
import { preventEnterDown } from '@/src/utils/app/forms';
import { isEntityIdPublic } from '@/src/utils/app/publications';

import { ApplicationStatus } from '@/src/types/applications';
import { ScreenState } from '@/src/types/common';
import { FileSourceType } from '@/src/types/files';
import { Translation } from '@/src/types/translation';

import { FilesSelectors } from '@/src/store/files/files.selectors';
import { useAppSelector } from '@/src/store/hooks';
import { ApplicationSelectors } from '@/src/store/selectors';
import { SettingsSelectors } from '@/src/store/settings/settings.selectors';

import {
  AppsEditorQuery,
  CONFIRM_ICON_FILE_VALUES,
  PUBLIC_APP_TOOLTIP,
} from '@/src/constants/applications';
import { IMAGE_TYPES } from '@/src/constants/chat';
import { BYTES_IN_KB } from '@/src/constants/file';
import { CommonI18nKeys } from '@/src/constants/i18n';
import { DEFAULT_VERSION } from '@/src/constants/publication';

import { BaseAppForm } from '@/src/components/AppsEditor/form';
import { DropdownSelector } from '@/src/components/Common/DropdownSelector';
import { Field } from '@/src/components/Common/Forms/Field';
import { withErrorMessage } from '@/src/components/Common/Forms/FieldErrorMessage';
import { FieldTextArea } from '@/src/components/Common/Forms/FieldTextArea';
import { withLabel } from '@/src/components/Common/Forms/Label';
import { CustomLogoSelect } from '@/src/components/Settings/CustomLogoSelect';

import { DialPrimaryButton } from '@epam/ai-dial-ui-kit';

const LogoSelector = withErrorMessage(withLabel(CustomLogoSelect));
const TopicsSelector = withLabel(DropdownSelector);

interface GeneralFormProps {
  onNextClick: () => void;
}

export const GeneralForm = ({ onNextClick }: GeneralFormProps) => {
  const { t } = useTranslation(Translation.Common);
  const { translateTopic, supplementalLabelsVersion } = useTopicTranslation();
  const router = useRouter();

  const { [AppsEditorQuery.PublicationUrl]: publicationUrl = '' } =
    router.query;

  const topics = useAppSelector(SettingsSelectors.selectTopics);
  const files = useAppSelector(FilesSelectors.selectFiles);
  const isAppLoading = useAppSelector(
    ApplicationSelectors.selectIsApplicationLoading,
  );
  const appDetails = useAppSelector(
    ApplicationSelectors.selectApplicationDetail,
  );

  const screenState = useScreenState();
  const isMobileView = screenState === ScreenState.SM;
  const isAppPublic = !!appDetails && isEntityIdPublic(appDetails);
  const isSharedWithMe = !!appDetails?.sharedWithMe;
  const isEditing = !!appDetails;
  const isAppDeployed =
    appDetails?.functionStatus === ApplicationStatus.DEPLOYED;
  const isDeploying =
    appDetails?.functionStatus === ApplicationStatus.DEPLOYING ||
    appDetails?.functionStatus === ApplicationStatus.REDEPLOYING;
  const isFieldDisabled =
    isAppDeployed || isSharedWithMe || isAppPublic || isDeploying;

  const { register, control } = useFormContext<BaseAppForm>();

  const { errors, isValid } = useFormState<BaseAppForm>({ control });

  const topicOptions = useMemo(
    () =>
      topics.map((topic) => ({
        ...topicToOption(topic),
        label: translateTopic(topic),
      })),
    [topics, translateTopic, supplementalLabelsVersion],
  );

  const getLogoId = useCallback(
    (filesIds: string[]) => files.find((f) => f.id === filesIds[0])?.id,
    [files],
  );

  const formatVersion = useCallback((e: FormEvent<HTMLInputElement>) => {
    const data = (e.nativeEvent as InputEvent).data;
    if (data && /[^0-9.]/.test(data)) e.preventDefault();
  }, []);

  const nameTooltip = useMemo(() => {
    if (isAppPublic) return PUBLIC_APP_TOOLTIP;
    if (isSharedWithMe) return getSharedTooltip('name');
    if (isAppDeployed) return t(CommonI18nKeys.UndeployApplicationToEditName);
    return '';
  }, [isAppPublic, isSharedWithMe, isAppDeployed, t]);

  const versionTooltip = useMemo(() => {
    if (isAppPublic) return PUBLIC_APP_TOOLTIP;
    if (isSharedWithMe) return getSharedTooltip('version');
    if (isAppDeployed)
      return t(CommonI18nKeys.UndeployApplicationToEditVersion);
    return '';
  }, [isAppPublic, isSharedWithMe, isAppDeployed, t]);

  const iconTooltip = useMemo(() => {
    if (isAppPublic) return PUBLIC_APP_TOOLTIP;
    if (isSharedWithMe) return getSharedTooltip('icon');
    return '';
  }, [isAppPublic, isSharedWithMe]);

  const iconWarning = appDetails?.isShared
    ? t(CommonI18nKeys.AfterYouAddOrChangeAnIcon)
    : '';

  const sourceFilters = useMemo(
    () =>
      publicationUrl?.toString()
        ? new Set([FileSourceType.MY_FILES, FileSourceType.REVIEW_FILES])
        : undefined,
    [publicationUrl],
  );

  const handleSubmit = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      onNextClick();
    },
    [onNextClick],
  );

  return (
    <form
      onSubmit={handleSubmit}
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
          error={errors.name?.message}
          disabled={isFieldDisabled}
          tooltip={nameTooltip}
        />
        <Field
          {...register('version')}
          label={t(CommonI18nKeys.Version)}
          onBeforeInput={formatVersion}
          mandatory
          placeholder={DEFAULT_VERSION}
          id="version"
          error={errors.version?.message}
          name="version"
          disabled={isFieldDisabled}
          tooltip={versionTooltip}
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
              fileManagerModalTitle={t(CommonI18nKeys.SelectApplicationIcon)}
              allowedTypes={IMAGE_TYPES}
              error={errors.iconUrl?.message}
              disabled={isSharedWithMe || isAppPublic}
              tooltip={iconTooltip}
              confirmDialogValues={
                appDetails?.isShared ? CONFIRM_ICON_FILE_VALUES : undefined
              }
              maxSelectableFileSize={100 * BYTES_IN_KB}
              warningMessage={iconWarning}
              sourceFilters={sourceFilters}
            />
          )}
        />
        <FieldTextArea
          {...register('description')}
          label={t(CommonI18nKeys.Description)}
          info={t(CommonI18nKeys.DescriptionInfo)}
          placeholder={t(CommonI18nKeys.ApplicationDescription)}
          rows={3}
          disabled={isAppPublic}
          tooltip={isAppPublic ? PUBLIC_APP_TOOLTIP : ''}
          className="resize-none"
          id="description"
        />
        <Controller
          name="topics"
          control={control}
          render={({ field }) => (
            <TopicsSelector
              label={t(CommonI18nKeys.Topics)}
              value={field.value?.map((topic) => ({
                ...topicToOption(topic),
                label: translateTopic(topic),
              }))}
              isDisabled={isAppPublic}
              tooltip={isAppPublic ? PUBLIC_APP_TOOLTIP : ''}
              options={topicOptions}
              placeholder={t(CommonI18nKeys.SelectOneOrMoreTopics)}
              onChange={(v) => field.onChange(v.map((o) => o.value))}
              id="topics-dropdown"
              isSearchable={!isMobileView}
              isMulti
              isClearable
              menuPlacement={isMobileView ? 'top' : 'auto'}
            />
          )}
        />
      </div>
      <div className="mt-auto flex justify-end gap-2 border-t border-tertiary px-3 py-4 md:px-5 xl:px-6">
        <DialPrimaryButton
          tooltipProps={{
            tooltip: t(CommonI18nKeys.FillInAllRequiredFields),
            hideTooltip: isValid || isEditing,
          }}
          label={t(CommonI18nKeys.Next)}
          data-qa="save-entity-general-info"
          type="submit"
          disabled={(!isValid && !isEditing) || isAppLoading}
        />
      </div>
    </form>
  );
};
