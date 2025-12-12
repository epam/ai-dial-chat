import { IconLogin, IconLogout } from '@tabler/icons-react';
import { useCallback } from 'react';
import { useFormContext, useWatch } from 'react-hook-form';

import classNames from 'classnames';

import { useTranslation } from '@/src/hooks/useTranslation';

import { isToolsetSignedIn } from '@/src/utils/app/toolsets';

import { ToolsetCredentialsLevel, ToolsetModel } from '@/src/types/toolsets';
import { Translation } from '@/src/types/translation';

import { Field } from '@/src/components/Common/Forms/Field';

import { ToolsetLoginFormType } from './form';

import { ToolsetAuthTypes } from '@epam/ai-dial-shared';
import { ButtonVariant, DialButton } from '@epam/ai-dial-ui-kit';

const fields = [
  'keyHeader',
  'apiKey',
  'clientId',
  'clientSecret',
] as (keyof ToolsetLoginFormType)[];

interface ToolsetLoginFormProps {
  type: ToolsetAuthTypes;
  toolset?: ToolsetModel;
  credentialsLevel?: ToolsetCredentialsLevel;
  disabled?: boolean;
  className?: string;
  buttonClassName?: string;
  fieldsTooltip?: string;
  onLogout?: () => void;
  onLogin?: (data: ToolsetLoginFormType) => void;
}

export const ToolsetLoginForm = ({
  type,
  toolset,
  credentialsLevel = ToolsetCredentialsLevel.GLOBAL,
  disabled = false,
  className,
  buttonClassName,
  fieldsTooltip,
  onLogout,
  onLogin,
}: ToolsetLoginFormProps) => {
  const { t } = useTranslation(Translation.Common);

  const isSignedIn = toolset && isToolsetSignedIn(toolset, credentialsLevel);

  const { register, formState, getValues, trigger, control } =
    useFormContext<ToolsetLoginFormType>();
  const errors = formState.errors;
  const isValid = formState.isValid;

  const includeOAuthFields = useWatch({
    name: 'includeOAuthFields',
    control,
  });

  const handleSubmit = useCallback(() => {
    if (isSignedIn) {
      onLogout?.();
    } else {
      trigger(fields).then((isValid) => {
        if (!isValid) return;
        const data = getValues();
        onLogin?.(data);
      });
    }
  }, [isSignedIn, onLogout, trigger, getValues, onLogin]);

  return (
    <div className={classNames('flex flex-col gap-4', className)}>
      {type === ToolsetAuthTypes.API_KEY && !isSignedIn && (
        <>
          <Field
            {...register('keyHeader')}
            label={t('API Key parameter name')}
            mandatory
            placeholder={t('Enter key name')}
            id="keyHeader"
            error={errors.keyHeader?.message}
            disabled={disabled}
            tooltip={fieldsTooltip}
          />
          <Field
            {...register('apiKey')}
            label={t('API Key')}
            mandatory
            placeholder={t('Enter API Key')}
            id="apiKey"
            error={errors.apiKey?.message}
            disabled={disabled}
            tooltip={fieldsTooltip}
          />
        </>
      )}

      {type === ToolsetAuthTypes.OAUTH && !isSignedIn && includeOAuthFields && (
        <>
          <Field
            {...register('clientId')}
            label={t('Client ID')}
            placeholder={t('Enter client ID')}
            id="clientId"
            disabled={disabled}
            error={errors.clientId?.message}
            mandatory
          />
          <Field
            {...register('clientSecret')}
            label={t('Client Secret')}
            placeholder={t('Enter client secret')}
            id="clientSecret"
            disabled={disabled}
            error={errors.clientSecret?.message}
            mandatory
            type="password"
            tooltip={fieldsTooltip}
          />
          <Field
            {...register('authorizationEndpoint')}
            label={t('Authorization endpoint')}
            placeholder={t('Enter authorization endpoint')}
            id="authorizationEndpoint"
            disabled={disabled}
            tooltip={fieldsTooltip}
          />
          <Field
            {...register('tokenEndpoint')}
            label={t('Token endpoint')}
            placeholder={t('Enter token endpoint')}
            id="tokenEndpoint"
            disabled={disabled}
            tooltip={fieldsTooltip}
          />
        </>
      )}

      <DialButton
        className="w-fit"
        variant={isSignedIn ? ButtonVariant.Secondary : ButtonVariant.Primary}
        data-qa="sign-in-button"
        disabled={disabled || !isValid}
        onClick={handleSubmit}
        iconBefore={
          isSignedIn ? (
            <IconLogout className="text-secondary" size={18} />
          ) : (
            <IconLogin size={18} />
          )
        }
        label={t(isSignedIn ? 'Log out' : 'Log in')}
      />
    </div>
  );
};
