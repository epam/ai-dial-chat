import { useCallback, useEffect, useRef } from 'react';
import { Path, RegisterOptions, useFormContext } from 'react-hook-form';

import { useRouter } from 'next/router';

import { useBeforeRedirect } from '@/src/hooks/useBeforeRedirect';
import { usePreventSpaceHandlers } from '@/src/hooks/usePreventSpaceHandlers';
import { useTranslation } from '@/src/hooks/useTranslation';

import { getValidFormFields } from '@/src/utils/app/forms';
import { isEntityIdPublic } from '@/src/utils/app/publications';

import { ApiDetailedApplicationTypeSchema } from '@/src/types/application-type-schema';
import { CustomApplicationModel } from '@/src/types/applications';
import { Translation } from '@/src/types/translation';

import { ApplicationActions, UIActions } from '@/src/store/actions';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { ApplicationSelectors } from '@/src/store/selectors';

import { PUBLIC_APP_TOOLTIP } from '@/src/constants/code-apps';

import { Field } from '@/src/components/Common/Forms/Field';

import { ExternalAppFormData, getExternalAppData } from '../form';

import isEqual from 'lodash-es/isEqual';

type Options<T extends Path<ExternalAppFormData>> = Omit<
  RegisterOptions<ExternalAppFormData, T>,
  'disabled' | 'valueAsNumber' | 'valueAsDate'
>;

type Validators = {
  [K in keyof ExternalAppFormData]?: Options<K>;
};

const validators: Validators = {
  externalUrl: {
    required: 'External URL is required',
    validate: (value: string) => {
      try {
        if (!value.startsWith('http://') && !value.startsWith('https://')) {
          return 'External URL must start with http:// or https://';
        }
        new URL(value);
        const bannedEndings = ['.', '//'];
        const endsWithBannedEnding = bannedEndings.some((ending) =>
          value.endsWith(ending),
        );
        if (endsWithBannedEnding) {
          return 'External URL cannot end with . or //';
        }
        return true;
      } catch {
        return 'External URL should be a valid URL.';
      }
    },
  },
};

interface Props {
  oldApplication: CustomApplicationModel;
  publicationUrl?: string;
  schema: ApiDetailedApplicationTypeSchema | null;
}

export const ExternalAppView: React.FC<Props> = ({
  schema,
  oldApplication,
  publicationUrl,
}) => {
  const { t } = useTranslation(Translation.Chat);
  const dispatch = useAppDispatch();
  const {
    register,
    handleSubmit: submitWrapper,
    formState: { errors, defaultValues, isValid },
    getValues,
    getFieldState,
  } = useFormContext<ExternalAppFormData>();
  const lastSubmittedValuesRef = useRef<ExternalAppFormData | undefined>(
    defaultValues as ExternalAppFormData,
  );

  const shouldSaveApplication = useAppSelector(
    ApplicationSelectors.selectShouldSaveApplication,
  );
  const exitAfterSave = useAppSelector(
    ApplicationSelectors.selectExitAfterSave,
  );

  const router = useRouter();

  const { onBeforeInput, onInput, onKeyDownOrPaste } =
    usePreventSpaceHandlers();

  const handleSubmit = useCallback(
    (data: ExternalAppFormData) => {
      const hasChanged = !isEqual(data, lastSubmittedValuesRef.current);

      if (hasChanged) {
        const applicationData = getExternalAppData(data);
        dispatch(
          ApplicationActions.update({
            oldApplication,
            publicationUrl,
            schema: schema ?? undefined,
            applicationData: {
              ...oldApplication,
              ...applicationData,
            },
          }),
        );
        lastSubmittedValuesRef.current = data;
      }
      if (exitAfterSave) {
        dispatch(ApplicationActions.exitEditor({}));
      }

      dispatch(ApplicationActions.setShouldSaveApplication(false));
      dispatch(ApplicationActions.setExitAfterSave(false));
    },
    [exitAfterSave, dispatch, oldApplication, publicationUrl, schema],
  );

  const isAppPublic = isEntityIdPublic(oldApplication);

  const autoSaveHandler = useCallback(() => {
    submitWrapper(handleSubmit)();
  }, [submitWrapper, handleSubmit]);

  const savePartialForm = useCallback(() => {
    if (isAppPublic) return;
    const data = getValues();
    if (!isValid && lastSubmittedValuesRef.current) {
      handleSubmit({
        ...lastSubmittedValuesRef.current,
        ...getValidFormFields(data, getFieldState),
      });
    } else if (isValid) {
      handleSubmit(data);
    }
  }, [getFieldState, getValues, handleSubmit, isValid, isAppPublic]);

  useBeforeRedirect(savePartialForm);

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
      autoSaveHandler();
    }
  }, [
    shouldSaveApplication,
    exitAfterSave,
    isValid,
    dispatch,
    router,
    t,
    autoSaveHandler,
  ]);

  return (
    <form
      onSubmit={submitWrapper(handleSubmit)}
      className="flex h-full flex-col bg-layer-2"
      data-qa="app-view-form"
    >
      <div className="grow space-y-4 divide-tertiary overflow-y-auto px-3 py-4 md:px-5 xl:py-5">
        <Field
          {...register('externalUrl', validators['externalUrl'])}
          label={t('External URL')}
          mandatory
          placeholder={t('Type chat external URL')}
          id="externalUrl"
          error={errors.externalUrl?.message}
          data-qa="external-url"
          onBeforeInput={onBeforeInput}
          onInput={onInput}
          onKeyDown={onKeyDownOrPaste}
          onPaste={onKeyDownOrPaste}
          disabled={isAppPublic}
          tooltip={isAppPublic ? PUBLIC_APP_TOOLTIP : ''}
        />
      </div>
    </form>
  );
};
