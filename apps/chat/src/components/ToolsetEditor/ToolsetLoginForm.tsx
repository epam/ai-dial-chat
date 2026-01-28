import { IconLogin, IconLogout } from '@tabler/icons-react';
import { useCallback } from 'react';
import {
  Controller,
  useFormContext,
  useFormState,
  useWatch,
} from 'react-hook-form';

import classNames from 'classnames';

import { useTranslation } from '@/src/hooks/useTranslation';

import { isToolsetSignedIn } from '@/src/utils/app/toolsets';

import { ToolsetCredentialsLevel, ToolsetModel } from '@/src/types/toolsets';
import { Translation } from '@/src/types/translation';

import { Field } from '@/src/components/Common/Forms/Field';
import { withErrorMessage } from '@/src/components/Common/Forms/FieldErrorMessage';
import { withLabel } from '@/src/components/Common/Forms/Label';
import { MultipleComboBox } from '@/src/components/Common/MultipleComboBox';

import { ToolsetLoginFormType, WithLogin } from './form';

import { ToolsetAuthTypes } from '@epam/ai-dial-shared';
import { DialNeutralButton, DialPrimaryButton } from '@epam/ai-dial-ui-kit';

const ComboBoxField = withErrorMessage(withLabel(MultipleComboBox));
const getItemLabel = (item: unknown): string => item as string;

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
  hideConfigFields?: boolean;
  fieldsInfo?: Partial<Record<keyof ToolsetLoginFormType, string>>;
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
  hideConfigFields = false,
  fieldsInfo,
}: ToolsetLoginFormProps) => {
  const { t } = useTranslation(Translation.Common);

  const isSignedIn = toolset && isToolsetSignedIn(toolset, credentialsLevel);

  const [LogInButton, LoginIcon] = isSignedIn
    ? [DialNeutralButton, IconLogout]
    : [DialPrimaryButton, IconLogin];

  const { register, getValues, trigger, control } =
    useFormContext<ToolsetLoginFormType>();
  const { isValid, errors } = useFormState<ToolsetLoginFormType>({ control });

  const withLogin = useWatch({
    name: 'withLogin',
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
          <div
            className={classNames({
              hidden: hideConfigFields,
            })}
          >
            <Field
              {...register('keyHeader')}
              label={t('API Key parameter name')}
              mandatory
              placeholder={t('Enter key name')}
              id="keyHeader"
              autoComplete="username"
              error={errors.keyHeader?.message}
              disabled={disabled}
              tooltip={fieldsTooltip}
            />
          </div>
          {withLogin === WithLogin.WithLogin && (
            <Field
              {...register('apiKey')}
              label={t('API Key')}
              mandatory
              type="password"
              placeholder={t('Enter API Key')}
              id="apiKey"
              autoComplete="current-password"
              error={errors.apiKey?.message}
              disabled={disabled}
              tooltip={fieldsTooltip}
              info={fieldsInfo?.['apiKey']}
            />
          )}
        </>
      )}

      {type === ToolsetAuthTypes.OAUTH &&
        !isSignedIn &&
        withLogin === WithLogin.WithConfig && (
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
            <Controller
              name="scopes"
              control={control}
              render={({ field }) => (
                <ComboBoxField
                  label={t('Supported scopes')}
                  info={t('Type in scope and press ENTER to add')}
                  initialSelectedItems={field.value}
                  getItemLabel={getItemLabel}
                  getItemValue={getItemLabel}
                  onChangeSelectedItems={field.onChange}
                  placeholder={t('Enter one or more supported scopes')}
                  id="scopes"
                  className="input-form input-invalid peer mx-0 flex items-start py-1 pl-0 hover:border-primary md:max-w-full"
                  hasDeleteAll
                  hideSuggestions
                  itemHeightClassName="h-[31px]"
                  dataQa="combobox"
                />
              )}
            />
          </>
        )}

      {withLogin !== WithLogin.WithoutLogin && (
        <LogInButton
          className={classNames('flex w-fit items-center', buttonClassName)}
          disabled={disabled || (!isValid && !isSignedIn)}
          onClick={handleSubmit}
          iconBefore={<LoginIcon size={18} />}
          label={t(isSignedIn ? 'Log out' : 'Log in')}
        />
      )}
    </div>
  );
};
