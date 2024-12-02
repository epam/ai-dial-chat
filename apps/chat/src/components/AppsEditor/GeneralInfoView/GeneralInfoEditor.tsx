import { useCallback, useMemo } from 'react';
import { Controller, useFormContext } from 'react-hook-form';

import { useTranslation } from 'next-i18next';
import { useRouter } from 'next/router';

import classNames from 'classnames';

import { topicToOption } from '@/src/utils/app/application';

import { ApplicationSlug } from '@/src/types/applications';

import { ApplicationActions } from '@/src/store/application/application.reducers';
import { FilesSelectors } from '@/src/store/files/files.reducers';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { SettingsSelectors } from '@/src/store/settings/settings.reducers';

import { IMAGE_TYPES } from '@/src/constants/chat';
import { DEFAULT_VERSION } from '@/src/constants/public';

import { DropdownSelector } from '@/src/components/Common/DropdownSelector';
import { withController } from '@/src/components/Common/Forms/ControlledFormField';
import { Field } from '@/src/components/Common/Forms/Field';
import { withErrorMessage } from '@/src/components/Common/Forms/FieldErrorMessage';
import { FieldTextArea } from '@/src/components/Common/Forms/FieldTextArea';
import { withLabel } from '@/src/components/Common/Forms/Label';
import { CustomLogoSelect } from '@/src/components/Settings/CustomLogoSelect';

import { FormData, getApplicationData } from './form';

const ControlledField = withController(Field);
const LogoSelector = withErrorMessage(withLabel(CustomLogoSelect));
const TopicsSelector = withLabel(DropdownSelector);

const isApplicationType = (value: unknown): value is ApplicationSlug => {
  return Object.values(ApplicationSlug).includes(value as ApplicationSlug);
};

export const GeneralInfoEditor = () => {
  const { t } = useTranslation();

  const dispatch = useAppDispatch();

  const router = useRouter();

  const files = useAppSelector(FilesSelectors.selectFiles);
  const topics = useAppSelector(SettingsSelectors.selectTopics);

  const {
    register,
    control,
    handleSubmit: submitWrapper,
    formState: { errors, isValid },
  } = useFormContext<FormData>();

  const getLogoId = useCallback(
    (filesIds: string[]) => files.find((f) => f.id === filesIds[0])?.id,
    [files],
  );

  const topicOptions = useMemo(() => topics.map(topicToOption), [topics]);

  const handleSubmit = (data: FormData) => {
    const { slug } = router.query;
    if (isApplicationType(slug)) {
      const preparedData = getApplicationData(data, slug);
      dispatch(ApplicationActions.create(preparedData));
    } else {
      // TO-DO: need to add notification
    }
  };

  return (
    <div className="size-full max-w-[1000px] overflow-hidden bg-layer-2">
      <form
        onSubmit={submitWrapper(handleSubmit)}
        className="flex size-full flex-col"
      >
        <div className="grow space-y-4 divide-tertiary overflow-y-auto p-5">
          <Field
            {...register('name')}
            label={t('Name')}
            mandatory
            placeholder={t('Type name') || ''}
            id="name"
            error={errors.name?.message}
          />

          <ControlledField
            label={t('Version')}
            placeholder={DEFAULT_VERSION}
            id="version"
            control={control}
            name="version"
          />

          <Controller
            name="iconUrl"
            control={control}
            render={({ field }) => (
              <LogoSelector
                label={t('Icon')}
                localLogo={field.value?.split('/')?.pop()}
                onLogoSelect={(v) => field.onChange(getLogoId(v))}
                onDeleteLocalLogoHandler={() => field.onChange('')}
                customPlaceholder={t('No icon')}
                className="max-w-full"
                fileManagerModalTitle="Select application icon"
                allowedTypes={IMAGE_TYPES}
              />
            )}
          />

          <FieldTextArea
            {...register('description')}
            label={t('Description')}
            placeholder={t('A description of your application') || ''}
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
                values={field.value?.map(topicToOption)}
                options={topicOptions}
                placeholder={t('Select one or more topics')}
                onChange={(v) => field.onChange(v.map((o) => o.value))}
              />
            )}
          />
        </div>

        <div
          className={classNames(
            'mt-auto flex gap-2 border-t border-tertiary p-4 md:px-6',
            'justify-end',
          )}
        >
          <button
            className="button button-primary"
            data-qa="save-application-dialog"
            type="submit"
            disabled={!isValid}
          >
            {t('Next')}
          </button>
        </div>
      </form>
    </div>
  );
};
