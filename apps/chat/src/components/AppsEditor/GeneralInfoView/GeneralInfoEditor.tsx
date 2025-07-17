import { useCallback, useEffect, useMemo } from 'react';
import { Controller, useFormContext } from 'react-hook-form';

import { useRouter } from 'next/router';

import classNames from 'classnames';

import { useTranslation } from '@/src/hooks/useTranslation';

import { getSharedTooltip, topicToOption } from '@/src/utils/app/application';
import { getLastPathSegment } from '@/src/utils/app/common';
import { isMobile } from '@/src/utils/app/mobile';
import { isEntityIdPublic } from '@/src/utils/app/publications';
import { getRouteForSlug } from '@/src/utils/app/route';

import { ApiDetailedApplicationTypeSchema } from '@/src/types/application-type-schema';
import {
  ApplicationType,
  CustomApplicationModel,
} from '@/src/types/applications';
import { Translation } from '@/src/types/translation';

import { ApplicationActions, UIActions } from '@/src/store/actions';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import {
  ApplicationSelectors,
  FilesSelectors,
  SettingsSelectors,
} from '@/src/store/selectors';

import { CONFIRM_ICON_FILE_VALUES } from '@/src/constants/applications';
import { IMAGE_TYPES } from '@/src/constants/chat';
import { PUBLIC_APP_TOOLTIP } from '@/src/constants/code-apps';
import { DEFAULT_VERSION } from '@/src/constants/publication';
import { Routes } from '@/src/constants/routes';

import { DropdownSelector } from '@/src/components/Common/DropdownSelector';
import { withController } from '@/src/components/Common/Forms/ControlledFormField';
import { Field } from '@/src/components/Common/Forms/Field';
import { withErrorMessage } from '@/src/components/Common/Forms/FieldErrorMessage';
import { FieldTextArea } from '@/src/components/Common/Forms/FieldTextArea';
import { withLabel } from '@/src/components/Common/Forms/Label';
import { CustomLogoSelect } from '@/src/components/Settings/CustomLogoSelect';

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
const LogoSelector = withErrorMessage(withLabel(CustomLogoSelect));
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
  const exitAfterSave = useAppSelector(
    ApplicationSelectors.selectExitAfterSave,
  );
  const shouldSaveApplication = useAppSelector(
    ApplicationSelectors.selectShouldSaveApplication,
  );

  const {
    register,
    control,
    handleSubmit: submitWrapper,
    formState: { errors, isValid, dirtyFields, touchedFields },
    reset,
  } = useFormContext<ApplicationGeneralInfoFormData>();

  const hasBeenTouched = Object.keys(touchedFields).length > 0;

  const getLogoId = useCallback(
    (filesIds: string[]) => files.find((f) => f.id === filesIds[0])?.id,
    [files],
  );

  const topicOptions = useMemo(() => topics.map(topicToOption), [topics]);
  const isFormChanged = Object.keys(dirtyFields).length > 0;
  const isAppPublic = !!oldApplication && isEntityIdPublic(oldApplication);

  const confirmIconValues = oldApplication?.isShared
    ? CONFIRM_ICON_FILE_VALUES
    : undefined;

  const iconWarning = oldApplication?.isShared
    ? t(
        'After you add or change an icon, other users will see the default one immediately after confirmation. Share the link again so they can see the new icon.',
      )
    : '';

  useEffect(() => {
    if (isFormChanged && isValid) {
      dispatch(ApplicationActions.setHasUnsavedChanges(isFormChanged));
    }
  }, [dispatch, isFormChanged, isValid]);

  const handleSubmit = useCallback(
    (data: ApplicationGeneralInfoFormData, isAutoSave = false) => {
      if (isAppPublic) {
        router.push({
          pathname: Routes.AppsEditorSettings,
          query: {
            id: router.query.id ?? '',
            slug: router.query.slug ?? '',
          },
        });
        return;
      }

      const { slug, publicationUrl } = router.query;
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
                ? getRouteForSlug(Routes.AppsEditorSettings, slugStr)
                : undefined,
              schema: schema ?? undefined,
              publicationUrl: publicationUrl
                ? decodeURIComponent(publicationUrl.toString())
                : undefined,
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

      if (exitAfterSave) {
        dispatch(ApplicationActions.exitEditor({}));
      }
      reset(data);
    },
    [
      dispatch,
      exitAfterSave,
      isAppDeployed,
      isAppPublic,
      isFormChanged,
      isSharedWithMe,
      oldApplication,
      reset,
      router,
      schema,
      t,
    ],
  );

  useEffect(() => {
    const isTriggered = shouldSaveApplication || exitAfterSave;
    if (!isTriggered) return;

    if (!isValid) {
      dispatch(ApplicationActions.setShouldSaveApplication(false));
      dispatch(ApplicationActions.setExitAfterSave(false));
      if (hasBeenTouched) {
        dispatch(
          UIActions.showErrorToast(t('Please fill in all mandatory fields')),
        );
      }
      return;
    }

    if (shouldSaveApplication) {
      submitWrapper((data) => handleSubmit(data, false))();
    }
  }, [
    shouldSaveApplication,
    exitAfterSave,
    dispatch,
    t,
    submitWrapper,
    handleSubmit,
    isValid,
    hasBeenTouched,
  ]);

  const isMobileView = isMobile();

  return (
    <div className="size-full overflow-hidden bg-layer-2">
      <form
        onSubmit={submitWrapper((data) => handleSubmit(data, false))}
        onMouseLeave={() => {
          if (!isAppPublic) {
            const submit = submitWrapper((data) => handleSubmit(data, true));
            submit();
          }
        }}
        className="flex size-full flex-col"
        data-qa="app-general-form"
      >
        <div className="grow space-y-4 divide-tertiary overflow-y-auto px-3 py-4 md:px-5 xl:py-5">
          <Field
            {...register('name', validators['name'])}
            label={t('Name')}
            mandatory
            placeholder={t('Type name')}
            id="name"
            error={errors.name?.message}
            disabled={isAppDeployed || isSharedWithMe || isAppPublic}
            tooltip={
              (isAppPublic && PUBLIC_APP_TOOLTIP) ||
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
            disabled={isAppDeployed || isSharedWithMe || isAppPublic}
            tooltip={
              (isAppPublic && PUBLIC_APP_TOOLTIP) ||
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
                id="icon"
                label={t('Icon')}
                localLogo={getLastPathSegment(field.value)}
                onLogoSelect={(v) => field.onChange(getLogoId(v))}
                onDeleteLocalLogoHandler={() => field.onChange('')}
                customPlaceholder={t('No icon')}
                className="max-w-full"
                fileManagerModalTitle="Select application icon"
                allowedTypes={IMAGE_TYPES}
                error={errors.iconUrl?.message}
                disabled={isSharedWithMe || isAppPublic}
                tooltip={
                  (isAppPublic && PUBLIC_APP_TOOLTIP) ||
                  (isSharedWithMe && getSharedTooltip('icon')) ||
                  ''
                }
                confirmDialogValues={confirmIconValues}
                warningMessage={iconWarning}
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
                label={t('Topics')}
                isDisabled={isAppPublic}
                tooltip={isAppPublic ? PUBLIC_APP_TOOLTIP : ''}
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

        <div
          className={classNames(
            'mt-auto flex gap-2 border-t border-tertiary px-3 py-4 md:px-5 xl:px-6',
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
