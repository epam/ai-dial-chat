import { useEffect } from 'react';
import { useFormContext, useWatch } from 'react-hook-form';

import { usePreventSpaceHandlers } from '@/src/hooks/usePreventSpaceHandlers';
import { useTranslation } from '@/src/hooks/useTranslation';

import { isEntityIdPublic } from '@/src/utils/app/publications';

import { Translation } from '@/src/types/translation';

import { useAppSelector } from '@/src/store/hooks';
import { ApplicationSelectors } from '@/src/store/selectors';

import { PUBLIC_APP_TOOLTIP } from '@/src/constants/code-apps';

import {
  ExternalAppForm as ExternalAppFormType,
  MANDATORY_FIELD_PLACEHOLDER,
} from '@/src/components/AppsEditor/form';
import { Field } from '@/src/components/Common/Forms/Field';

export const ExternalAppForm = () => {
  const { t } = useTranslation(Translation.Marketplace);

  const appDetails = useAppSelector(
    ApplicationSelectors.selectApplicationDetail,
  );

  const { formState, register, setValue, clearErrors, control } =
    useFormContext<ExternalAppFormType>();
  const errors = formState.errors;

  const externalUrl = useWatch({
    name: 'externalUrl',
    control,
  });

  const isAppPublic = !!appDetails && isEntityIdPublic(appDetails);

  const { onBeforeInput, onInput, onKeyDownOrPaste } =
    usePreventSpaceHandlers();

  useEffect(() => {
    if (externalUrl === MANDATORY_FIELD_PLACEHOLDER) {
      setValue('externalUrl', '', { shouldDirty: false, shouldTouch: false });
      clearErrors('externalUrl');
    }
  }, [clearErrors, externalUrl, setValue]);

  return (
    <div
      className="flex size-full grow flex-col space-y-4 divide-tertiary overflow-hidden overflow-y-auto bg-layer-2 px-3 py-4 md:px-5 xl:py-5"
      data-qa="app-view-form"
    >
      <Field
        {...register('externalUrl')}
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
  );
};
