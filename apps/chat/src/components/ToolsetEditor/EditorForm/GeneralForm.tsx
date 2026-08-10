import { IconPencilMinus, IconPlus } from '@tabler/icons-react';
import React, {
  ComponentProps,
  FormEvent,
  useCallback,
  useMemo,
  useState,
} from 'react';
import {
  Controller,
  useFormContext,
  useFormState,
  useWatch,
} from 'react-hook-form';

import { useScreenState } from '@/src/hooks/useScreenState';
import { useTopicTranslation } from '@/src/hooks/useTopicTranslation';
import { useTranslation } from '@/src/hooks/useTranslation';

import { topicToOption } from '@/src/utils/app/application';
import { getLastPathSegment } from '@/src/utils/app/common';
import { LocalesService } from '@/src/utils/app/data/locales-service';
import { preventEnterDown } from '@/src/utils/app/forms';
import { getEntityPayloadFromLocals } from '@/src/utils/app/marketplace-localization';

import { ScreenState } from '@/src/types/common';
import { MarketplaceEntity } from '@/src/types/marketplace';
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
import { LocalesPopup } from '@/src/components/ToolsetEditor/EditorForm/LocalesPopup';
import { ToolsetEditorForm } from '@/src/components/ToolsetEditor/form';

import {
  DialLinkButton,
  DialPrimaryButton,
  ElementSize,
} from '@epam/ai-dial-ui-kit';

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
  const { translateTopic } = useTopicTranslation();

  const [localsPopup, setLocalsPopup] = useState(false);

  const topics = useAppSelector(SettingsSelectors.selectTopics);
  const files = useAppSelector(FilesSelectors.selectFiles);
  const isToolsetDetailsLoading = useAppSelector(
    ToolsetSelectors.selectIsToolsetDetailsLoading,
  );
  const _availableLocales = useAppSelector(
    SettingsSelectors.selectAvailableLocales,
  );
  const primaryLocale = LocalesService.getPrimaryLocale();
  const availableLocales = useMemo(
    () => _availableLocales.filter((locale) => locale !== primaryLocale),
    [_availableLocales, primaryLocale],
  );

  const screenState = useScreenState();
  const isMobileView = screenState === ScreenState.SM;
  const isEditing = !!toolset;

  const { register, control, setValue } = useFormContext<ToolsetEditorForm>();
  const { errors, isValid } = useFormState<ToolsetEditorForm>({ control });

  const locales = useWatch({
    control,
    name: 'locales',
  });

  const topicOptions = useMemo(
    () =>
      topics.map((topic) => ({
        ...topicToOption(topic),
        label: translateTopic(topic),
      })),
    [topics, translateTopic],
  );

  const getLogoId = useCallback(
    (filesIds: string[]) => files.find((f) => f.id === filesIds[0])?.id,
    [files],
  );

  const formatVersion = useCallback((e: FormEvent<HTMLInputElement>) => {
    const data = (e.nativeEvent as InputEvent).data;
    if (data && /[^0-9.]/.test(data)) e.preventDefault();
  }, []);

  const handleLocalsChange: ComponentProps<typeof LocalesPopup>['onSubmit'] =
    useCallback(
      (data) => {
        setValue('locales', data.locales, {
          shouldTouch: true,
          shouldDirty: true,
        });
        setLocalsPopup(false);
      },
      [setValue],
    );

  const langPostfix = availableLocales.length
    ? ` [${primaryLocale.toUpperCase()}]`
    : '';

  return (
    <>
      <form
        onSubmit={onNextClick}
        className="flex size-full flex-col overflow-hidden bg-layer-2"
        data-qa="entity-general-form"
        onKeyDown={preventEnterDown}
      >
        <div className="grow space-y-4 divide-tertiary overflow-y-auto px-3 py-4 md:px-5 xl:py-5">
          <Field
            {...register('name')}
            label={`${t(CommonI18nKeys.Name)}${langPostfix}`}
            mandatory
            placeholder={t(CommonI18nKeys.TypeName)}
            id="name"
            disabled={isToolsetPublic}
            error={errors.name?.message}
            tooltip={isToolsetPublic ? PUBLIC_TOOLSET_TOOLTIP : undefined}
          />
          <Field
            {...register('version')}
            label={t(CommonI18nKeys.Version)}
            onBeforeInput={formatVersion}
            mandatory
            placeholder={DEFAULT_VERSION}
            id="version"
            disabled={isToolsetPublic}
            tooltip={isToolsetPublic ? PUBLIC_TOOLSET_TOOLTIP : undefined}
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
                fileManagerModalTitle={t(CommonI18nKeys.SelectToolsetIcon)}
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
            label={`${t(CommonI18nKeys.Description)}${langPostfix}`}
            placeholder={t(CommonI18nKeys.ToolsetDescription)}
            info={t(CommonI18nKeys.DescriptionInfo)}
            rows={3}
            className="resize-none"
            id="description"
            disabled={isToolsetPublic}
            tooltip={isToolsetPublic ? PUBLIC_TOOLSET_TOOLTIP : undefined}
          />

          {!!availableLocales.length && (
            <div className="flex items-center gap-1">
              {!!locales.length && (
                <span className="text-xs font-semibold text-secondary">
                  {t(CommonI18nKeys.Locales)}:{' '}
                  {locales
                    .map(({ locale }) => `[${locale.toUpperCase()}]`)
                    .join(', ')}
                </span>
              )}

              <DialLinkButton
                className="border-none"
                label={t(
                  locales.length
                    ? CommonI18nKeys.Edit
                    : CommonI18nKeys.AddLocales,
                )}
                iconBefore={
                  locales.length ? (
                    <IconPencilMinus size={16} />
                  ) : (
                    <IconPlus size={16} />
                  )
                }
                onClick={() => setLocalsPopup(true)}
                size={ElementSize.Small}
              />
            </div>
          )}

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

      {localsPopup && (
        <LocalesPopup
          onSubmit={handleLocalsChange}
          onClose={() => setLocalsPopup(false)}
          entity={getEntityPayloadFromLocals(locales) as MarketplaceEntity}
        />
      )}
    </>
  );
};
