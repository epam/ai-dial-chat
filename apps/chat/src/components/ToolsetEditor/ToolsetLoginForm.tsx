import { IconLogin, IconLogout } from '@tabler/icons-react';
import { useCallback, useEffect } from 'react';
import { useForm } from 'react-hook-form';

import classNames from 'classnames';

import { useTranslation } from '@/src/hooks/useTranslation';

import { ToolsetCredentialsLevel, ToolsetModel } from '@/src/types/toolsets';
import { Translation } from '@/src/types/translation';

import { Field } from '@/src/components/Common/Forms/Field';

import { ToolsetLoginFormSchema, ToolsetLoginFormType } from './form';

import { ToolsetAuthStatus, ToolsetAuthTypes } from '@epam/ai-dial-shared';
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
}

export const ToolsetLoginForm = ({
  type,
  onLogout,
  onLogin,
  toolset,
  credentialsLevel = ToolsetCredentialsLevel.GLOBAL,
  disabled = false,
  className,
}: ToolsetLoginFormProps) => {
  const { t } = useTranslation(Translation.Common);

  const authStatus =
    toolset?.authSettings?.authStatus?.[credentialsLevel] ??
    ToolsetAuthStatus.SIGNED_OUT;
  const isLoggedIn = authStatus === ToolsetAuthStatus.SIGNED_IN;

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
    if (authStatus === ToolsetAuthStatus.SIGNED_IN) {
      onLogout?.();
    } else {
      trigger().then((isValid) => {
        if (!isValid) return;
        const data = getValues();
        onLogin?.(data);
      });
    }
  }, [authStatus, onLogout, trigger, getValues, onLogin]);

  useEffect(() => {
    reset(getDefaultFormData({ type, toolset, prevData: getValues() }));
  }, [getValues, reset, toolset, type]);

  return (
    <div className={classNames('flex flex-col gap-4', className)}>
      {type === ToolsetAuthTypes.API_KEY && !isLoggedIn && (
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

      <button
        className="button button-primary flex w-fit items-center gap-2 py-2"
        disabled={disabled || (!isValid && !isLoggedIn)}
        onClick={handleSubmit}
      >
        {isLoggedIn ? <IconLogout size={18} /> : <IconLogin size={18} />}
        {t(isLoggedIn ? 'Log out' : 'Log in')}
      </button>
    </div>
  );
};
