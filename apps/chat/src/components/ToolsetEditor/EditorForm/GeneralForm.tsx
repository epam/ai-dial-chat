import { FormEvent, useCallback, useMemo } from 'react';
import { Controller, useFormContext } from 'react-hook-form';

import { useScreenState } from '@/src/hooks/useScreenState';
import { useTranslation } from '@/src/hooks/useTranslation';

import { topicToOption } from '@/src/utils/app/application';
import { getLastPathSegment } from '@/src/utils/app/common';

import { ScreenState } from '@/src/types/common';
import { Translation } from '@/src/types/translation';

import { FilesSelectors } from '@/src/store/files/files.selectors';
import { useAppSelector } from '@/src/store/hooks';
import { SettingsSelectors } from '@/src/store/settings/settings.selectors';
import { ToolsetSelectors } from '@/src/store/toolset/toolset.selectors';

import { IMAGE_TYPES } from '@/src/constants/chat';
import { DEFAULT_VERSION } from '@/src/constants/publication';

import { DropdownSelector } from '@/src/components/Common/DropdownSelector';
import { Field } from '@/src/components/Common/Forms/Field';
import { withErrorMessage } from '@/src/components/Common/Forms/FieldErrorMessage';
import { FieldTextArea } from '@/src/components/Common/Forms/FieldTextArea';
import { withLabel } from '@/src/components/Common/Forms/Label';
import { CustomLogoSelect } from '@/src/components/Settings/CustomLogoSelect';
import { ToolsetEditorForm } from '@/src/components/ToolsetEditor/form';

const LogoSelector = withErrorMessage(withLabel(CustomLogoSelect));
const TopicsSelector = withLabel(DropdownSelector);

interface GeneralFormProps {
  onNextClick: (e: React.FormEvent<HTMLFormElement>) => void;
}

export const GeneralForm = ({ onNextClick }: GeneralFormProps) => {
  const { t } = useTranslation(Translation.Common);

  const topics = useAppSelector(SettingsSelectors.selectTopics);
  const files = useAppSelector(FilesSelectors.selectFiles);
  const isToolsetDetailsLoading = useAppSelector(
    ToolsetSelectors.selectIsToolsetDetailsLoading,
  );

  const screenState = useScreenState();
  const isMobileView = screenState === ScreenState.SM;

  const {
    register,
    formState: { errors, isValid },
    control,
  } = useFormContext<ToolsetEditorForm>();

  const topicOptions = useMemo(() => topics.map(topicToOption), [topics]);

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
    >
      <div className="grow space-y-4 divide-tertiary overflow-y-auto px-3 py-4 md:px-5 xl:py-5">
        <Field
          {...register('name')}
          label={t('Name')}
          mandatory
          placeholder={t('Type name')}
          id="name"
          error={errors.name?.message}
        />
        <Field
          {...register('version')}
          label={t('Version')}
          onBeforeInput={formatVersion}
          mandatory
          placeholder={DEFAULT_VERSION}
          id="version"
          error={errors.version?.message}
          name="version"
        />
        <Controller
          name="iconUrl"
          control={control}
          render={({ field }) => (
            <LogoSelector
              id="icon"
              label={t('Icon')}
              localLogo={getLastPathSegment(field.value)}
              onLogoSelect={(v) => field.onChange(getLogoId(v))}
              onDeleteLocalLogoHandler={() => field.onChange('')}
              customPlaceholder={t('No icon')}
              className="max-w-full"
              fileManagerModalTitle="Select toolset icon"
              allowedTypes={IMAGE_TYPES}
              error={errors.iconUrl?.message}
            />
          )}
        />
        <FieldTextArea
          {...register('description')}
          label={t('Description')}
          placeholder={t('A description of your toolset')}
          info={t(
            'The first paragraph serves as a short description. To create an extended description, enter two line breaks and start the second paragraph.',
          )}
          rows={3}
          className="resize-none"
          id="description"
        />
        <Controller
          name="topics"
          control={control}
          render={({ field }) => (
            <TopicsSelector
              label={t('Topics')}
              value={field.value?.map(topicToOption)}
              options={topicOptions}
              placeholder={t('Select one or more topics')}
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
        <button
          className="button button-primary py-2"
          type="submit"
          disabled={!isValid || isToolsetDetailsLoading}
        >
          {t('Next')}
        </button>
      </div>
    </form>
  );
};
