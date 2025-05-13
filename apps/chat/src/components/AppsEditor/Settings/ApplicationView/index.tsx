import { useCallback, useEffect, useRef } from 'react';
import {
  Controller,
  Path,
  RegisterOptions,
  useFormContext,
} from 'react-hook-form';

import { useRouter } from 'next/router';

import classNames from 'classnames';

import { usePreventSpaceHandlers } from '@/src/hooks/usePreventSpaceHandlers';
import { useTranslation } from '@/src/hooks/useTranslation';

import { isEntityIdPublic } from '@/src/utils/app/publications';

import { CustomApplicationModel } from '@/src/types/applications';
import { Translation } from '@/src/types/translation';

import { ApplicationActions } from '@/src/store/application/application.reducers';
import { ApplicationSelectors } from '@/src/store/application/application.selectors';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { UIActions } from '@/src/store/ui/ui.reducers';

import { PUBLIC_APP_TOOLTIP } from '@/src/constants/code-apps';
import { MIME_FORMAT_REGEX } from '@/src/constants/file';

import { withController } from '@/src/components/Common/Forms/ControlledFormField';
import { Field } from '@/src/components/Common/Forms/Field';
import { withErrorMessage } from '@/src/components/Common/Forms/FieldErrorMessage';
import { FieldTextArea } from '@/src/components/Common/Forms/FieldTextArea';
import { withLabel } from '@/src/components/Common/Forms/Label';
import { MultipleComboBox } from '@/src/components/Common/MultipleComboBox';

import {
  CustomApplicationFormData,
  getAttachmentTypeErrorHandlers,
  getCustomApplicationData,
} from '../form';

import isEqual from 'lodash-es/isEqual';

const ComboBoxField = withErrorMessage(withLabel(MultipleComboBox));
const ControlledField = withController(Field);

type Options<T extends Path<CustomApplicationFormData>> = Omit<
  RegisterOptions<CustomApplicationFormData, T>,
  'disabled' | 'valueAsNumber' | 'valueAsDate'
>;

type Validators = {
  [K in keyof CustomApplicationFormData]?: Options<K>;
};

const validators: Validators = {
  features: {
    validate: (data) => {
      if (!data?.trim()) return true;
      try {
        const object = JSON.parse(data);
        if (typeof object === 'object' && !!object && !Array.isArray(object)) {
          for (const [key, value] of Object.entries(object)) {
            if (!key.trim()) {
              return 'Keys should not be empty';
            }
            const valueType = typeof value;
            if (
              !(['boolean', 'number'].includes(valueType) || value === null)
            ) {
              if (typeof value === 'string' && !value.trim()) {
                return 'String values should not be empty';
              }
              if (!['boolean', 'number', 'string'].includes(valueType)) {
                return 'Values should be a string, number, boolean or null';
              }
            }
          }
        } else {
          return 'Data is not a valid JSON object';
        }
        return true;
      } catch (error) {
        return 'Invalid JSON string';
      }
    },
  },
  inputAttachmentTypes: {
    validate: (types) =>
      types.every((v) => MIME_FORMAT_REGEX.test(v)) ||
      'Please match the MIME format',
  },
  maxInputAttachments: {
    validate: (v?: number | '') => {
      if (v === '' || v === undefined) return true;
      const reg = /^[0-9]+$/;
      return reg.test(String(v)) || 'Max attachments must be a number';
    },
    setValueAs: (v: string): number | '' =>
      v === '' ? '' : Number(v.replace(/[^0-9]/g, '')),
  },
  completionUrl: {
    required: 'Completion URL is required',
    validate: (value) => {
      try {
        if (!value.startsWith('http://') && !value.startsWith('https://')) {
          return 'Completion URL must start with http:// or https://';
        }
        new URL(value);
        const bannedEndings = ['.', '//'];
        const endsWithBannedEnding = bannedEndings.some((ending) =>
          value.endsWith(ending),
        );
        if (endsWithBannedEnding) {
          return 'Completion URL cannot end with . or //';
        }
        return true;
      } catch {
        return 'Completion URL should be a valid URL.';
      }
    },
  },
};

const getItemLabel = (item: unknown): string => item as string;

interface Props {
  oldApplication: CustomApplicationModel;
}

export const ApplicationView: React.FC<Props> = ({ oldApplication }) => {
  const { t } = useTranslation(Translation.Chat);
  const dispatch = useAppDispatch();
  const {
    register,
    control,
    handleSubmit: submitWrapper,
    formState: { errors, defaultValues, isValid },
    setError,
    clearErrors,
  } = useFormContext<CustomApplicationFormData>();
  const lastSubmittedValuesRef = useRef<CustomApplicationFormData | undefined>(
    defaultValues as CustomApplicationFormData,
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
    (data: CustomApplicationFormData) => {
      if (
        !isEqual(data, lastSubmittedValuesRef.current) &&
        shouldSaveApplication
      ) {
        const applicationData = getCustomApplicationData(data);
        dispatch(
          ApplicationActions.update({
            oldApplication,
            applicationData: {
              ...oldApplication,
              ...applicationData,
            },
          }),
        );
        lastSubmittedValuesRef.current = data;
      } else if (shouldSaveApplication && exitAfterSave) {
        dispatch(ApplicationActions.exitEditor({}));
      } else {
        dispatch(ApplicationActions.setShouldSaveApplication(false));
        dispatch(ApplicationActions.setExitAfterSave(false));
      }
    },
    [exitAfterSave, shouldSaveApplication, dispatch, oldApplication],
  );

  const autoSaveHandler = useCallback(() => {
    submitWrapper(handleSubmit)();
  }, [submitWrapper, handleSubmit]);

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
    submitWrapper,
    handleSubmit,
    dispatch,
    router,
    t,
    autoSaveHandler,
  ]);

  const isAppPublic = isEntityIdPublic(oldApplication);

  return (
    <form
      onSubmit={submitWrapper(handleSubmit)}
      className="flex h-full flex-col bg-layer-2"
      data-qa="app-view-form"
    >
      <div className="grow space-y-4 divide-tertiary overflow-y-auto p-5">
        <FieldTextArea
          {...register('features', validators['features'])}
          label={t('Features data')}
          info={t(
            'Enter key-value pairs for rate_endpoint and/or configuration_endpoint in JSON format.',
          )}
          placeholder={`{\n\t"rate_endpoint": "http://application1/rate",\n\t"configuration_endpoint": "http://application1/configuration"\n}`}
          id="features"
          rows={4}
          data-qa="features-data"
          error={errors.features?.message}
          disabled={isAppPublic}
          tooltip={isAppPublic ? PUBLIC_APP_TOOLTIP : ''}
        />
        <Controller
          name="inputAttachmentTypes"
          rules={validators['inputAttachmentTypes']}
          control={control}
          render={({ field }) => (
            <ComboBoxField
              label={t('Attachment types')}
              info={t("Input the MIME type and press 'Enter' to add")}
              initialSelectedItems={field.value}
              getItemLabel={getItemLabel}
              getItemValue={getItemLabel}
              onChangeSelectedItems={field.onChange}
              placeholder={t('Enter one or more attachment types')}
              id="attachmentTypes"
              className={classNames(
                'input-form input-invalid peer mx-0 flex items-start py-1 pl-0 md:max-w-full',
                isAppPublic && 'hover:border-primary',
              )}
              hasDeleteAll
              hideSuggestions
              itemHeightClassName="h-[31px]"
              error={errors.inputAttachmentTypes?.message}
              disabled={isAppPublic}
              tooltip={isAppPublic ? PUBLIC_APP_TOOLTIP : ''}
              {...getAttachmentTypeErrorHandlers(setError, clearErrors)}
            />
          )}
        />
        <ControlledField
          label={t('Max. attachments number')}
          placeholder={t('Enter the maximum number of attachments')}
          id="maxInputAttachments"
          error={errors.maxInputAttachments?.message}
          control={control}
          name="maxInputAttachments"
          rules={validators['maxInputAttachments']}
          disabled={isAppPublic}
          tooltip={isAppPublic ? PUBLIC_APP_TOOLTIP : ''}
        />
        <Field
          {...register('completionUrl', validators['completionUrl'])}
          label={t('Chat completion URL')}
          mandatory
          placeholder={t('Type chat completion URL')}
          id="completionUrl"
          error={errors.completionUrl?.message}
          data-qa="completion-url"
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
