import { IconPlus } from '@tabler/icons-react';
import React, { useCallback, useMemo } from 'react';
import {
  Controller,
  useFieldArray,
  useForm,
  useFormState,
  useWatch,
} from 'react-hook-form';

import { useTranslation } from '@/src/hooks/useTranslation';

import { LocalesService } from '@/src/utils/app/data/locales-service';
import { preventEnterDown } from '@/src/utils/app/forms';
import { getEntityLocals } from '@/src/utils/app/marketplace-localization';

import { DropdownSelectorOption } from '@/src/types/common';
import { MarketplaceEntity } from '@/src/types/marketplace';
import { Translation } from '@/src/types/translation';

import { useAppSelector } from '@/src/store/hooks';
import { SettingsSelectors } from '@/src/store/selectors';

import { CommonI18nKeys } from '@/src/constants/i18n';
import { EntityLocalesSchema } from '@/src/constants/validation-helpers';

import { DropdownSelector } from '@/src/components/Common/DropdownSelector';
import { Field } from '@/src/components/Common/Forms/Field';
import { FieldTextArea } from '@/src/components/Common/Forms/FieldTextArea';
import { withLabel } from '@/src/components/Common/Forms/Label';

import {
  DialGhostButton,
  DialLinkButton,
  DialPopup,
  DialPrimaryButton,
  DialRemoveButton,
  PopupSize,
} from '@epam/ai-dial-ui-kit';
import { zodResolver } from '@hookform/resolvers/zod';
import { z as zodValidation } from 'zod';

const SelectorField = withLabel(DropdownSelector);

const FormSchema = zodValidation.object({
  locales: EntityLocalesSchema,
});

type LocalsForm = zodValidation.infer<typeof FormSchema>;

const getDefaultForm = <T extends MarketplaceEntity>(
  entity: T | undefined,
  availableLocals: string[],
): LocalsForm => {
  const entityLocals = getEntityLocals(entity, true);

  return {
    locales: entityLocals.length
      ? entityLocals
      : [
          {
            locale: availableLocals[0],
            name: '',
            description: '',
          },
        ],
  };
};

interface LocalsPopupProps<T extends MarketplaceEntity> {
  entity?: T;
  onSubmit: (value: LocalsForm) => void;
  onClose: () => void;
  descriptionPlaceholder?: string;
  readonly?: boolean;
  fieldTooltip?: string;
}

export const LocalesPopup = <T extends MarketplaceEntity>({
  entity,
  onSubmit,
  onClose,
  descriptionPlaceholder,
  readonly = false,
  fieldTooltip,
}: LocalsPopupProps<T>) => {
  const { t } = useTranslation(Translation.Common);

  const _availableLocals = useAppSelector(
    SettingsSelectors.selectAvailableLocales,
  );
  const availableLocals = _availableLocals.filter(
    (local) => local !== LocalesService.getPrimaryLocale(),
  );

  const { control, handleSubmit, register, trigger } = useForm<LocalsForm>({
    mode: 'onChange',
    reValidateMode: 'onChange',
    resolver: zodResolver(FormSchema),
    defaultValues: getDefaultForm(entity, availableLocals),
  });

  const { errors, isDirty, isValid } = useFormState({ control });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'locales',
  });

  // useWatch is more reactive than fields array
  const localesValue = useWatch({
    control,
    name: 'locales',
  });

  const localOptions = useMemo(
    () =>
      availableLocals
        .filter(
          (locale) => !localesValue.some((field) => field.locale === locale),
        )
        .map((locale) => ({
          value: locale,
          label: locale.toUpperCase(),
        })),
    [availableLocals, localesValue],
  );

  const handleAppend = useCallback(() => {
    append({
      locale: localOptions[0]?.value,
      name: '',
      description: '',
    });
  }, [append, localOptions]);

  const isAddLocaleDisabled = !localOptions.length || readonly;
  const isApplyDisabled = !isDirty || !isValid || readonly;

  const applyTooltip = useMemo(
    () =>
      !isValid
        ? t(CommonI18nKeys.FillInAllRequiredFields)
        : t(CommonI18nKeys.NoChangesToApply),
    [isValid, t],
  );

  const handleApply = useCallback(() => {
    trigger().then((valid) => {
      if (valid) handleSubmit(onSubmit)();
    });
  }, [handleSubmit, onSubmit, trigger]);

  return (
    <form onKeyDown={preventEnterDown}>
      <DialPopup
        open
        header={t(readonly ? CommonI18nKeys.Locales : CommonI18nKeys.AddLocale)}
        headerClassName="px-3 md:px-6 pt-4 md:pt-6"
        className="mx-3 !h-auto !max-h-[600px] !bg-layer-2 md:m-0"
        onClose={onClose}
        portalId="chat"
        size={PopupSize.Md}
        footer={
          !readonly ? (
            <div className="flex justify-end gap-2 border-t border-t-tertiary px-3 py-4 md:px-6">
              <DialGhostButton
                label={t(CommonI18nKeys.Cancel)}
                onClick={onClose}
              />
              <DialPrimaryButton
                label={t(CommonI18nKeys.Apply)}
                disabled={isApplyDisabled}
                tooltipProps={{
                  tooltip: fieldTooltip || applyTooltip,
                  hideTooltip: !isApplyDisabled,
                }}
                onClick={handleApply}
              />
            </div>
          ) : undefined
        }
      >
        <div className="flex flex-col gap-2 overflow-hidden p-3 md:p-6">
          <div className="flex flex-col gap-8 overflow-y-scroll">
            {fields.map((item, index) => (
              <div key={item.id} className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-secondary">
                    {t(CommonI18nKeys.Locale)} {index + 1}
                  </label>

                  <DialRemoveButton
                    onClick={() => remove(index)}
                    disabled={readonly}
                    tooltipProps={{
                      tooltip: fieldTooltip,
                      hideTooltip: !readonly,
                    }}
                  />
                </div>

                <div className="grid grid-cols-[auto_1fr] gap-5">
                  <Controller
                    control={control}
                    name={`locales.${index}.locale`}
                    render={({ field }) => (
                      <SelectorField
                        id={`${index}-locale`}
                        label={t(CommonI18nKeys.Language)}
                        isSearchable={false}
                        isClearable={false}
                        closeMenuOnSelect
                        options={localOptions}
                        value={{
                          value: field.value,
                          label: field.value.toUpperCase(),
                        }}
                        onChange={(option) =>
                          field.onChange(
                            (option as unknown as DropdownSelectorOption).value,
                          )
                        }
                        isDisabled={readonly}
                        tooltip={fieldTooltip}
                      />
                    )}
                  />
                  <Field
                    {...register(`locales.${index}.name`)}
                    label={t(CommonI18nKeys.Name)}
                    mandatory
                    placeholder={t(CommonI18nKeys.TypeName)}
                    id={`${index}-name`}
                    error={errors.locales?.[index]?.name?.message}
                    disabled={readonly}
                    tooltip={fieldTooltip}
                  />
                  <div className="col-span-2">
                    <FieldTextArea
                      {...register(`locales.${index}.description`)}
                      label={t(CommonI18nKeys.Description)}
                      placeholder={descriptionPlaceholder}
                      info={t(CommonI18nKeys.DescriptionInfo)}
                      rows={3}
                      className="resize-none"
                      id={`${index}-description`}
                      disabled={readonly}
                      tooltip={fieldTooltip}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <DialLinkButton
            label={t(CommonI18nKeys.AddLocale)}
            iconBefore={<IconPlus />}
            onClick={handleAppend}
            disabled={isAddLocaleDisabled}
            tooltipProps={{
              tooltip:
                fieldTooltip || t(CommonI18nKeys.AllAvailableLocalesAdded),
              hideTooltip: !isAddLocaleDisabled,
              triggerClassName: 'w-fit',
            }}
            className="w-fit"
          />
        </div>
      </DialPopup>
    </form>
  );
};
