import { useCallback, useEffect, useMemo } from 'react';
import { Controller, useFormContext } from 'react-hook-form';

import { useRouter } from 'next/router';

import classNames from 'classnames';

import { useTranslation } from '@/src/hooks/useTranslation';

import { getSharedTooltip, topicToOption } from '@/src/utils/app/application';
import { encode } from '@/src/utils/app/application-type-schema';
import { getRouteForSlug } from '@/src/utils/app/route';

import { ApiDetailedApplicationTypeSchema } from '@/src/types/application-type-schema';
import {
  ApplicationType,
  CustomApplicationModel,
} from '@/src/types/applications';
import { Translation } from '@/src/types/translation';

import {
  ApplicationActions,
  ApplicationSelectors,
} from '@/src/store/application/application.reducers';
import { FilesSelectors } from '@/src/store/files/files.reducers';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { SettingsSelectors } from '@/src/store/settings/settings.reducers';
import { UIActions } from '@/src/store/ui/ui.reducers';

import { CONFIRM_ICON_FILE_VALUES } from '@/src/constants/applications';
import { IMAGE_TYPES } from '@/src/constants/chat';
import { MarketplaceTabs } from '@/src/constants/marketplace';
import { DEFAULT_VERSION } from '@/src/constants/public';
import { Routes } from '@/src/constants/routes';

import { DropdownSelector } from '@/src/components/Common/DropdownSelector';
import { withController } from '@/src/components/Common/Forms/ControlledFormField';
import { Field } from '@/src/components/Common/Forms/Field';
import { withErrorMessage } from '@/src/components/Common/Forms/FieldErrorMessage';
import { FieldTextArea } from '@/src/components/Common/Forms/FieldTextArea';
import { withLabel } from '@/src/components/Common/Forms/Label';
import { CustomLogoSelect } from '@/src/components/Settings/CustomLogoSelect';

import { withWarningMessage } from '../../Common/Forms/FieldWarningMessage';
import {
  ApplicationGeneralInfoFormData,
  getApplicationData,
  validators,
} from './form';

interface Props {
  schema: ApiDetailedApplicationTypeSchema | null;
  isSharedWithMe: boolean;
  isAppDeployed: boolean;
  oldApplication?: CustomApplicationModel;
}

const ControlledField = withController(Field);
const LogoSelector = withErrorMessage(
  withWarningMessage(withLabel(CustomLogoSelect)),
);
const TopicsSelector = withLabel(DropdownSelector);

export const GeneralInfoEditor: React.FC<Props> = ({
  oldApplication,
  schema,
  isSharedWithMe,
  isAppDeployed,
}) => {
  const { t } = useTranslation(Translation.Chat);

  const dispatch = useAppDispatch();

  const router = useRouter();

  const files = useAppSelector(FilesSelectors.selectFiles);
  const topics = useAppSelector(SettingsSelectors.selectTopics);

  const {
    register,
    control,
    handleSubmit: submitWrapper,
    formState: { errors, isValid, dirtyFields },
    reset,
  } = useFormContext<ApplicationGeneralInfoFormData>();

  const getLogoId = useCallback(
    (filesIds: string[]) => files.find((f) => f.id === filesIds[0])?.id,
    [files],
  );

  const topicOptions = useMemo(() => topics.map(topicToOption), [topics]);

  const exitAfterSave = useAppSelector(
    ApplicationSelectors.selectExitAfterSave,
  );

  const isFormChanged = Object.keys(dirtyFields).length > 0;

  const shouldSaveApplication = useAppSelector(
    ApplicationSelectors.selectShouldSaveApplication,
  );

  const confirmIconValues = oldApplication?.isShared
    ? CONFIRM_ICON_FILE_VALUES
    : undefined;

  const handleSubmit = useCallback(
    (data: ApplicationGeneralInfoFormData, isAutoSave = false) => {
      const { slug } = router.query;
      if (!slug) return;

      const slugStr = slug.toString();
      const preparedData = getApplicationData(data, slugStr, schema);

      if (slugStr === ApplicationType.CODE_APP) {
        preparedData.functionStatus =
          data?.functionStatus ?? oldApplication?.functionStatus;
      }

      if (oldApplication) {
        if (isFormChanged || !isAutoSave) {
          dispatch(
            ApplicationActions.update({
              applicationData: {
                ...preparedData,
                isShared: oldApplication?.isShared,
                sharedWithMe: isSharedWithMe,
                reference: data.reference,
                id: oldApplication?.id,
              },
              oldApplication: oldApplication,
              redirectUrl: !isAutoSave
                ? getRouteForSlug(Routes.AppsEditorSettings, encode(slugStr))
                : undefined,
              schema: schema ?? undefined,
            }),
          );
        }

        if (!isAutoSave && isAppDeployed) {
          dispatch(
            UIActions.showWarningToast(
              t('Saved changes will be applied during next deployment'),
            ),
          );
        }
      } else if (!isAutoSave) {
        dispatch(
          ApplicationActions.create({
            applicationData: preparedData,
            slug: slugStr,
            schema: schema ?? undefined,
          }),
        );
      }

      reset(data);
    },
    [
      router.query,
      schema,
      oldApplication,
      reset,
      isFormChanged,
      isAppDeployed,
      dispatch,
      isSharedWithMe,
      t,
    ],
  );

  useEffect(() => {
    const isTriggered = shouldSaveApplication || exitAfterSave;
    if (!isTriggered) return;

    if (!isValid) {
      dispatch(ApplicationActions.setShouldSaveApplication(false));
      dispatch(ApplicationActions.setExitAfterSave(false));
      dispatch(
        UIActions.showErrorToast(t('Please fill in all mandatory fields')),
      );
      return;
    }

    if (shouldSaveApplication) {
      submitWrapper((data) => handleSubmit(data, false))();
    }

    if (exitAfterSave) {
      router.push({
        pathname: Routes.Marketplace,
        query: { tab: MarketplaceTabs.MY_WORKSPACE },
      });
    }
  }, [
    shouldSaveApplication,
    exitAfterSave,
    isValid,
    dispatch,
    t,
    submitWrapper,
    handleSubmit,
    router,
  ]);

  return (
    <div className="size-full overflow-hidden bg-layer-2">
      <form
        onSubmit={submitWrapper((data) => handleSubmit(data, false))}
        onMouseLeave={submitWrapper((data) => handleSubmit(data, true))}
        className="flex size-full flex-col"
        data-qa="app-general-form"
      >
        <div className="grow space-y-4 divide-tertiary overflow-y-auto p-5">
          <Field
            {...register('name', validators['name'])}
            label={t('Name')}
            mandatory
            placeholder={t('Type name')}
            id="name"
            error={errors.name?.message}
            disabled={isAppDeployed || isSharedWithMe}
            tooltip={
              (isSharedWithMe && getSharedTooltip('name')) ||
              (isAppDeployed && t('Undeploy application to edit name')) ||
              ''
            }
          />

          <ControlledField
            label={t('Version')}
            mandatory
            placeholder={DEFAULT_VERSION}
            id="version"
            error={errors.version?.message}
            control={control}
            name="version"
            rules={validators['version']}
            disabled={isAppDeployed || isSharedWithMe}
            tooltip={
              (isSharedWithMe && getSharedTooltip('version')) ||
              (isAppDeployed && t('Undeploy application to edit version')) ||
              ''
            }
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
                error={errors.iconUrl?.message}
                disabled={isSharedWithMe}
                tooltip={isSharedWithMe ? getSharedTooltip('icon') : ''}
                warning={confirmIconValues?.description}
                confirmDialogValues={confirmIconValues}
              />
            )}
          />

          <FieldTextArea
            {...register('description')}
            label={t('Description')}
            info={t(
              'The first paragraph serves as a short description. To create an extended description, enter two line breaks and start the second paragraph.',
            )}
            placeholder={t('A description of your application')}
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
            data-qa="save-application-general-info"
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
