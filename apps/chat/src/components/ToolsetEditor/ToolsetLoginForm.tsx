import { IconLogin, IconLogout } from '@tabler/icons-react';
import { useCallback, useEffect } from 'react';
import { useForm } from 'react-hook-form';

import classNames from 'classnames';

import { useTranslation } from '@/src/hooks/useTranslation';

import { isToolsetSignedIn } from '@/src/utils/app/toolsets';

import { ToolsetCredentialsLevel, ToolsetModel } from '@/src/types/toolsets';
import { Translation } from '@/src/types/translation';

import { Field } from '@/src/components/Common/Forms/Field';

import { ToolsetLoginFormSchema, ToolsetLoginFormType } from './form';

import { ToolsetAuthTypes } from '@epam/ai-dial-shared';
import { zodResolver } from '@hookform/resolvers/zod';

const getDefaultFormData = ({
  type,
  toolset,
  prevData,
}: {
  type: ToolsetAuthTypes;
  toolset?: ToolsetModel;
  prevData?: ToolsetLoginFormType;
}): ToolsetLoginFormType => {
  switch (type) {
    case ToolsetAuthTypes.API_KEY:
      return {
        type: ToolsetAuthTypes.API_KEY,
        keyHeader: toolset?.authSettings?.apiKeyHeader ?? 'api_key',
        apiKey: prevData?.apiKey ?? '',
      };
    case ToolsetAuthTypes.OAUTH:
    case ToolsetAuthTypes.NONE:
    default:
      return {
        type,
      };
  }
};

interface ToolsetLoginFormProps {
  type: ToolsetAuthTypes;
  onLogout?: () => void;
  onLogin?: (data: ToolsetLoginFormType) => void;
  toolset?: ToolsetModel;
  credentialsLevel?: ToolsetCredentialsLevel;
  disabled?: boolean;
  className?: string;
  buttonClassName?: string;
  showOAuthClientForm?: boolean;
}

export const ToolsetLoginForm = ({
  type,
  onLogout,
  onLogin,
  toolset,
  credentialsLevel = ToolsetCredentialsLevel.GLOBAL,
  disabled = false,
  className,
  buttonClassName,
  showOAuthClientForm = false,
}: ToolsetLoginFormProps) => {
  const { t } = useTranslation(Translation.Common);

  const isSignedIn = toolset && isToolsetSignedIn(toolset, credentialsLevel);

  const { reset, register, formState, getValues, trigger } =
    useForm<ToolsetLoginFormType>({
      defaultValues: getDefaultFormData({ type, toolset }),
      mode: 'onChange',
      reValidateMode: 'onChange',
      resolver: zodResolver(ToolsetLoginFormSchema),
    });
  const isValid = formState.isValid;
  const errors = formState.errors;

  const handleSubmit = useCallback(() => {
    if (isSignedIn) {
      onLogout?.();
    } else {
      trigger().then((isValid) => {
        if (!isValid) return;
        const data = getValues();
        onLogin?.(data);
      });
    }
  }, [isSignedIn, onLogout, trigger, getValues, onLogin]);

  useEffect(() => {
    reset(getDefaultFormData({ type, toolset, prevData: getValues() }));
  }, [getValues, reset, toolset, type]);

  return (
    <div className={classNames('flex flex-col gap-4', className)}>
      {type === ToolsetAuthTypes.API_KEY && !isSignedIn && (
        <>
          <Field
            {...register('keyHeader')}
            label={t('API Key parameter name')}
            mandatory
            placeholder={t('Type key name')}
            id="keyHeader"
            error={errors.keyHeader?.message}
            disabled={disabled}
          />
          <Field
            {...register('apiKey')}
            label={t('API Key')}
            mandatory
            placeholder={t('Type API Key')}
            id="apiKey"
            error={errors.apiKey?.message}
            disabled={disabled}
          />
        </>
      )}

      {type === ToolsetAuthTypes.OAUTH &&
        !isSignedIn &&
        showOAuthClientForm && (
          <>
            <Field
              {...register('clientId')}
              label={t('Client id')}
              placeholder={t('Type client id')}
              id="clientId"
              disabled={disabled}
            />
            <Field
              {...register('clientSecret')}
              label={t('Client secret')}
              placeholder={t('Type client secret')}
              id="clientSecret"
              disabled={disabled}
            />
            <Field
              {...register('authorizationEndpoint')}
              label={t('Authorization endpoint')}
              placeholder={t('Type authorization endpoint')}
              id="authorizationEndpoint"
              disabled={disabled}
            />
            <Field
              {...register('tokenEndpoint')}
              label={t('Token endpoint')}
              placeholder={t('Type token endpoint')}
              id="tokenEndpoint"
              disabled={disabled}
            />
          </>
        )}

      <button
        className={classNames(
          'button flex w-fit items-center gap-2 py-2',
          buttonClassName,
          isSignedIn ? 'button-secondary' : 'button-primary',
        )}
        disabled={disabled || (!isValid && !isSignedIn)}
        onClick={handleSubmit}
      >
        {isSignedIn ? (
          <IconLogout className="text-secondary" size={18} />
        ) : (
          <IconLogin size={18} />
        )}
        {t(isSignedIn ? 'Log out' : 'Log in')}
      </button>
    </div>
  );
};
