import { IconExclamationCircle } from '@tabler/icons-react';
import { useEffect, useState } from 'react';
import Select, {
  ClassNamesConfig,
  OptionProps,
  SingleValueProps,
  components,
} from 'react-select';

import { useTranslation } from 'next-i18next';

import { OpenAIEntityModel, OpenAIEntityModelID } from '@/types/openai';

import { SelectIcon } from '../Select/SelectIcon';

interface Props {
  models: OpenAIEntityModel[];
  conversationModelId: string;
  conversationModelName: string;
  defaultModelId: OpenAIEntityModelID;
  onSelectModel: (modelId: string) => void;
}

interface ModelsSelectOption {
  value: string;
  label: string;
  isDisabled: boolean;
}

const CustomSelectOption = (props: OptionProps<ModelsSelectOption>) => {
  const { data, children, isSelected } = props;
  return (
    <>
      <components.Option
        {...props}
        isDisabled={data.isDisabled}
        className={`!p-0 !pl-4 dark:text-white hover:dark:bg-[#40414F] hover:cursor-pointer ${
          isSelected ? 'dark:bg-[#202123]' : 'dark:bg-[#343541]'
        } ${
          data.isDisabled
            ? 'dark:!text-neutral-400 hover:!cursor-not-allowed dark:!bg-[#40414F]'
            : ''
        }`}
      >
        <SelectIcon modelId={data.value}>{children}</SelectIcon>
      </components.Option>
    </>
  );
};

const CustomSingleValue = (props: SingleValueProps<ModelsSelectOption>) => {
  const { children, getValue } = props;
  const selectedOption = getValue()[0];
  return (
    <components.SingleValue className="!pl-1" {...props}>
      {selectedOption ? (
        <SelectIcon modelId={selectedOption.value}>{children}</SelectIcon>
      ) : (
        children
      )}
    </components.SingleValue>
  );
};

const selectClassNames: ClassNamesConfig<ModelsSelectOption> = {
  control: (state) =>
    `dark:bg-[#343541] dark:text-white hover:dark:border-white hover:dark:shadow-white  !rounded-lg ${
      state.isFocused
        ? 'dark:border-white dark:shadow-white dark:shadow-sm'
        : ''
    }`,
  placeholder: (state) => 'text-neutral-900 dark:text-white',
  valueContainer: (state) => '!text-neutral-900 hover:cursor-text',
  menu: (state) =>
    '!mt-1 dark:bg-[#343541] !rounded !shadow-md !shadow-neutral-400 dark:!shadow-[#717283]',
  singleValue: (state) => '!text-neutral-900 dark:!text-white center m-0',
  dropdownIndicator: (state) =>
    '!py-0 hover:!text-neutral-900 hover:dark:!text-white',
  input: (state) => 'dark:!text-white',
};

export const ModelSelect = ({
  conversationModelId,
  conversationModelName,
  models,
  defaultModelId,
  onSelectModel,
}: Props) => {
  const { t } = useTranslation('chat');

  const [isNotAllowedModelSelected, setIsNotAllowedModelSelected] =
    useState(false);

  const selectOptions: ModelsSelectOption[] = models.map((model) => {
    return {
      value: model.id,
      label:
        model.id === defaultModelId ? `Default (${model.name})` : model.name,
      isDisabled: false,
    };
  });
  const selectOptionsWithNotAllowedModel: ModelsSelectOption[] =
    isNotAllowedModelSelected
      ? selectOptions.concat({
          value: conversationModelId,
          label: conversationModelName,
          isDisabled: true,
        })
      : selectOptions;

  const conversationOption: ModelsSelectOption = {
    value: conversationModelId,
    label:
      conversationModelId === defaultModelId
        ? `Default (${conversationModelName})`
        : conversationModelName,
    isDisabled: isNotAllowedModelSelected,
  };
  const defaultModelOption: ModelsSelectOption | undefined =
    selectOptionsWithNotAllowedModel.find(
      ({ value }) => value === defaultModelId,
    );
  useEffect(() => {
    const modelsIds = models.map(({ id }) => id);
    setIsNotAllowedModelSelected(!modelsIds.includes(conversationModelId));
  }, [conversationModelId, models]);

  return (
    <div className="flex flex-col">
      <label className="mb-2 text-left text-neutral-700 dark:text-neutral-400">
        {t('Model')}
      </label>
      <Select<ModelsSelectOption>
        className="w-full rounded-lg text-neutral-900 dark:text-white dark:bg-[#343541]"
        classNames={selectClassNames}
        options={selectOptionsWithNotAllowedModel}
        placeholder={t('Select a model') || ''}
        defaultValue={conversationOption || defaultModelOption}
        onChange={(option) => {
          if (option) onSelectModel(option.value);
        }}
        components={{
          Option: CustomSelectOption,
          SingleValue: CustomSingleValue,
        }}
      />
      {conversationModelId === OpenAIEntityModelID.GPT_4_32K && (
        <div className="w-full mt-3 text-left text-orange-600 dark:text-orange-600 flex gap-2 items-center">
          <IconExclamationCircle size={18} />
          <div>
            Please only use this one if you absolutely need it. It&apos;s slower
            and more expensive.
          </div>
        </div>
      )}
    </div>
  );
};
