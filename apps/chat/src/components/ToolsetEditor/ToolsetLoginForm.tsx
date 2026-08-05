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
import { translate } from '@/src/utils/app/translation';

import { DropdownSelectorOption } from '@/src/types/common';
import { ToolsetCredentialsLevel, ToolsetModel } from '@/src/types/toolsets';
import { Translation } from '@/src/types/translation';

import { CommonI18nKeys } from '@/src/constants/i18n';

import { DropdownSelector } from '@/src/components/Common/DropdownSelector';
import { Field } from '@/src/components/Common/Forms/Field';
import { withErrorMessage } from '@/src/components/Common/Forms/FieldErrorMessage';
import { withLabel } from '@/src/components/Common/Forms/Label';
import { MultipleComboBox } from '@/src/components/Common/MultipleComboBox';
import { ToolsetRepairButton } from '@/src/components/Marketplace/ToolsetRepairButton';

import { ToolsetLoginFormType, WithLogin } from './form';

import {
  TokenEndpointAuthMethod,
  ToolsetAuthTypes,
} from '@epam/ai-dial-shared';
import { DialNeutralButton, DialPrimaryButton } from '@epam/ai-dial-ui-kit';

const ComboBoxField = withErrorMessage(withLabel(MultipleComboBox));
const SelectorField = withLabel(DropdownSelector);
const getItemLabel = (item: unknown): string => item as string;

const TOKEN_ENDPOINT_AUTH_METHOD_LABELS: Record<
  TokenEndpointAuthMethod,
  string
> = {
  [TokenEndpointAuthMethod.ClientSecretBasic]: translate(
    CommonI18nKeys.TokenEndpointAuthMethodBasic,
    { ns: Translation.Common },
  ),
  [TokenEndpointAuthMethod.ClientSecretPost]: translate(
    CommonI18nKeys.TokenEndpointAuthMethodPost,
    { ns: Translation.Common },
  ),
  [TokenEndpointAuthMethod.None]: translate(
    CommonI18nKeys.TokenEndpointAuthMethodNone,
    { ns: Translation.Common },
  ),
};

const tokenEndpointAuthMethodOptions = Object.values(
  TokenEndpointAuthMethod,
).map((value) => ({
  value,
  label: TOKEN_ENDPOINT_AUTH_METHOD_LABELS[value],
}));

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
  withRepair?: boolean;
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
  withRepair = false,
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

  const showRepair = withRepair && withLogin === WithLogin.WithLogin;

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
    <div
      className={classNames('flex flex-col gap-3', className)}
      data-qa="login-form"
    >
      {type === ToolsetAuthTypes.API_KEY && !isSignedIn && (
        <>
          <div
            className={classNames({
              hidden: hideConfigFields,
            })}
          >
            <Field
              {...register('keyHeader')}
              label={t(CommonI18nKeys.ApiKeyParameterName)}
              mandatory
              placeholder={t(CommonI18nKeys.EnterKeyName)}
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
              label={t(CommonI18nKeys.ApiKeyCommon)}
              mandatory
              type="password"
              placeholder={t(CommonI18nKeys.EnterApiKey)}
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
              label={t(CommonI18nKeys.ClientIdCommon)}
              placeholder={t(CommonI18nKeys.EnterClientId)}
              id="clientId"
              disabled={disabled}
              error={errors.clientId?.message}
              mandatory
            />
            <Field
              {...register('clientSecret')}
              label={t(CommonI18nKeys.ClientSecretCommon)}
              placeholder={t(CommonI18nKeys.EnterClientSecret)}
              id="clientSecret"
              disabled={disabled}
              error={errors.clientSecret?.message}
              mandatory
              type="password"
              tooltip={fieldsTooltip}
            />
            <Field
              {...register('authorizationEndpoint')}
              label={t(CommonI18nKeys.AuthorizationEndpoint)}
              placeholder={t(CommonI18nKeys.EnterAuthorizationEndpoint)}
              id="authorizationEndpoint"
              disabled={disabled}
              tooltip={fieldsTooltip}
            />
            <Field
              {...register('tokenEndpoint')}
              label={t(CommonI18nKeys.TokenEndpoint)}
              placeholder={t(CommonI18nKeys.EnterTokenEndpoint)}
              id="tokenEndpoint"
              disabled={disabled}
              tooltip={fieldsTooltip}
            />
            <Controller
              name="tokenEndpointAuthMethod"
              control={control}
              render={({ field }) => {
                const value =
                  field.value ?? TokenEndpointAuthMethod.ClientSecretPost;
                return (
                  <SelectorField
                    label={t(CommonI18nKeys.TokenEndpointAuthMethodLabel)}
                    isSearchable={false}
                    isClearable={false}
                    id="tokenEndpointAuthMethod"
                    value={{
                      label: t(TOKEN_ENDPOINT_AUTH_METHOD_LABELS[value]),
                      value,
                    }}
                    options={tokenEndpointAuthMethodOptions}
                    onChange={(option) =>
                      field.onChange(
                        (option as unknown as DropdownSelectorOption).value,
                      )
                    }
                    closeMenuOnSelect
                    isDisabled={disabled}
                    tooltip={fieldsTooltip}
                  />
                );
              }}
            />
            <Controller
              name="scopes"
              control={control}
              render={({ field }) => (
                <ComboBoxField
                  label={t(CommonI18nKeys.SupportedScopes)}
                  info={t(CommonI18nKeys.TypeInScopeAndPressEnter)}
                  initialSelectedItems={field.value}
                  getItemLabel={getItemLabel}
                  getItemValue={getItemLabel}
                  onChangeSelectedItems={field.onChange}
                  placeholder={t(CommonI18nKeys.EnterOneOrMoreScopes)}
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

      <div className="flex items-center gap-2">
        {withLogin !== WithLogin.WithoutLogin && (
          <LogInButton
            className={classNames('flex w-fit items-center', buttonClassName)}
            disabled={disabled || (!isValid && !isSignedIn)}
            onClick={handleSubmit}
            iconBefore={<LoginIcon size={18} />}
            label={t(
              isSignedIn
                ? CommonI18nKeys.LogOutCommon
                : CommonI18nKeys.LogInCommon,
            )}
          />
        )}

        {showRepair && (
          <ToolsetRepairButton toolset={toolset} authType={type} />
        )}
      </div>
    </div>
  );
};
